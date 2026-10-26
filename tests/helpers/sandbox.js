import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGitCli } from '../../src/adapters/git-cli.js';

const INHERITED_GIT_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_CONFIG', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS'];

/**
 * Builds a throwaway git environment with its own "global" config file, so tests
 * exercise the real git binary without reading or writing the developer's config.
 */
export async function createSandbox(t) {
  // Git answers with real paths. On macOS the temporary folder is behind a symlink
  // (/var is /private/var), so the sandbox starts from its real path to match them.
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'gas-test-')));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

  const globalConfig = path.join(root, 'global.gitconfig');
  await writeFile(globalConfig, '');

  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_CEILING_DIRECTORIES: root,
  };
  for (const name of INHERITED_GIT_VARIABLES) delete env[name];

  const git = createGitCli({ env });

  async function run(args) {
    const result = await git(args);
    if (result.code !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
    return result.stdout.replace(/\r?\n$/, '');
  }

  return {
    root,
    env,
    git,
    globalConfig,

    async makeDir(name) {
      const dir = path.join(root, name);
      await mkdir(dir, { recursive: true });
      return dir;
    },

    async initRepo(name) {
      const dir = path.join(root, name);
      await mkdir(dir, { recursive: true });
      await run(['-C', dir, 'init', '--quiet']);
      return dir;
    },

    setGlobal: (key, value) => run(['config', '--global', key, value]),

    setLocal: (repo, key, value) => run(['-C', repo, 'config', '--local', key, value]),

    async getLocal(repo, key) {
      const result = await git(['-C', repo, 'config', '--local', '--get', key]);
      return result.code === 0 ? result.stdout.replace(/\r?\n$/, '') : null;
    },

    readGlobalFile: () => readFile(globalConfig, 'utf8'),
  };
}

export const personal = Object.freeze({
  id: 'account-personal',
  label: 'Personal',
  gitName: 'Ada Lovelace',
  gitEmail: 'ada@example.com',
  githubUser: 'ada-personal',
  sshKeyPath: null,
});

export const work = Object.freeze({
  id: 'account-work',
  label: 'Work',
  gitName: 'Ada L.',
  gitEmail: 'ada@company.example',
  githubUser: 'ada-work',
  sshKeyPath: null,
});
