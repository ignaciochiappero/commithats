import { app, BrowserWindow, clipboard as systemClipboard, dialog, ipcMain, Menu, nativeTheme, session } from 'electron';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFiles } from '../adapters/files.js';
import { createGitCli } from '../adapters/git-cli.js';
import { createJsonStore } from '../adapters/json-store.js';
import { createSshKeygen } from '../adapters/ssh-keygen.js';
import { createAppService } from '../core/app-service.js';
import { createGcm } from '../core/gcm.js';
import { languageForLocale } from '../core/settings.js';
import { withToolPath } from '../core/tool-path.js';
import { registerIpc } from './ipc.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RENDERER_ENTRY = path.join(here, '..', 'renderer', 'index.html');
const PRELOAD_SCRIPT = path.join(here, 'preload.cjs');
const APP_ICON = path.join(here, '..', 'assets', 'icon.png');
const STATE_FILE = 'state.json';
const ACCOUNT_FILES_DIR = 'accounts';
// Named here instead of derived from the product name: the rules in the global git config
// point into this folder, so renaming the product must never move it. It still carries the
// name the app had before it was called Commit Hats.
const DATA_FOLDER = 'git-account-switcher';
// The ground color of each theme, so the window is never a white flash before the page paints.
const GROUND = { dark: '#1a1514', light: '#f4ebea' };
const SYSTEM_NAMES = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
// The menu bar of macOS is always there. It carries what people expect of any app there,
// such as Quit and the copy and paste shortcuts, and leaves out Electron's own developer menus.
const MACOS_MENU = [{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }];
const { version: APP_VERSION } = createRequire(import.meta.url)('../../package.json');

/**
 * Boots the app and resolves once the window has loaded.
 *
 * The options let a smoke run point the app at throwaway data, a throwaway SSH
 * folder, a stand-in credential manager and a stand-in clipboard, and pin the
 * language it starts in. `npm start` uses the defaults: the real git, the real Git
 * Credential Manager, `~/.ssh`, the system clipboard and the language of the system.
 */
export async function startApp({
  userDataDir = process.env.COMMITHATS_DATA_DIR,
  git = createGitCli({ env: { ...withToolPath(process.env), GIT_TERMINAL_PROMPT: '0' } }),
  gcm = createGcm(git),
  keygen = createSshKeygen({ env: withToolPath(process.env) }),
  sshDir = path.join(os.homedir(), '.ssh'),
  clipboard = systemClipboard,
  defaultLanguage,
  show = true,
} = {}) {
  // Must run before the first await: Electron reads these settings when it becomes ready.
  app.setPath('userData', userDataDir ? path.resolve(userDataDir) : path.join(app.getPath('appData'), DATA_FOLDER));
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return null;
  }

  let mainWindow = null;
  let openingWindow = null;

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // The language of the system is only known once Electron is ready.
  await app.whenReady();

  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate(MACOS_MENU));
    // The packaged app has its icon in its bundle; run from source, the Dock would show Electron's.
    if (!app.isPackaged) app.dock?.setIcon(APP_ICON);
  }

  const userData = app.getPath('userData');
  const service = createAppService({
    git,
    gcm,
    keygen,
    sshDir,
    store: createJsonStore(path.join(userData, STATE_FILE)),
    files: createFiles(),
    includeDir: path.join(userData, ACCOUNT_FILES_DIR),
    homeDir: os.homedir(),
    defaultLanguage: defaultLanguage ?? languageForLocale(app.getLocale()),
  });

  const groundColor = () => (nativeTheme.shouldUseDarkColors ? GROUND.dark : GROUND.light);

  // The page follows `prefers-color-scheme`, and so do the title bar and the native dialogs.
  function applyTheme(theme) {
    nativeTheme.themeSource = theme;
    mainWindow?.setBackgroundColor(groundColor());
  }

  async function createWindow() {
    const { language } = await service.getSettings();
    mainWindow = new BrowserWindow({
      width: 1080,
      height: 720,
      minWidth: 860,
      minHeight: 560,
      show: false,
      autoHideMenuBar: true,
      title: 'Commit Hats',
      icon: APP_ICON,
      backgroundColor: groundColor(),
      webPreferences: {
        preload: PRELOAD_SCRIPT,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: false,
        // A window that is hidden on purpose (a smoke run) must keep painting to be captured.
        backgroundThrottling: show,
      },
    });

    // The window only ever shows the bundled page.
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
    mainWindow.once('ready-to-show', () => {
      if (show) mainWindow.show();
    });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // The page reads its language from its own address, so even its first paint is in that language.
    await mainWindow.loadFile(RENDERER_ENTRY, { query: { lang: language } });
    return mainWindow;
  }

  // On macOS the app stays open without a window, and clicking it in the Dock asks for one.
  // That can happen while the first one is still opening, which must not give two windows.
  function openWindow() {
    openingWindow ??= createWindow().finally(() => {
      openingWindow = null;
    });
    return openingWindow;
  }

  registerIpc({
    ipcMain,
    dialog,
    clipboard,
    service,
    getWindow: () => mainWindow,
    homeDir: os.homedir(),
    appInfo: {
      version: APP_VERSION,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      system: `${SYSTEM_NAMES[process.platform] ?? process.platform} ${os.release()} (${process.arch})`,
      dataDir: userData,
    },
    onSettingsChanged: (settings) => applyTheme(settings.theme),
  });

  app.on('activate', () => {
    if (!mainWindow) openWindow();
  });

  // The page needs no browser permission (camera, location, notifications...), so every request is refused.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  applyTheme((await service.getSettings()).theme);
  return { window: await openWindow(), service };
}
