// Where git and Git Credential Manager are installed on macOS outside the system folders:
// Homebrew on Apple silicon, then Homebrew on Intel and the installers of both programs.
const MACOS_TOOL_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];

/**
 * The environment for the programs the app runs, with the folders they are usually in.
 *
 * An app opened from the Finder or the Dock on macOS does not get the `PATH` of the
 * terminal, only the system folders, so it would miss the git and the credential manager
 * the person installed. The missing folders go first, as the terminal puts them, so the
 * same git answers in both. Other systems hand apps the full `PATH` and are left as they are.
 */
export function withToolPath(env, platform = process.platform) {
  if (platform !== 'darwin') return env;

  const dirs = (env.PATH ?? '').split(':').filter((dir) => dir !== '');
  const missing = MACOS_TOOL_DIRS.filter((dir) => !dirs.includes(dir));
  return missing.length === 0 ? env : { ...env, PATH: [...missing, ...dirs].join(':') };
}
