# Security

Commit Hats changes which GitHub account your git projects use. It does that by writing git configuration, and it never holds a password or a token. This page says exactly what it reads, writes, and runs, so you can decide whether to trust it.

## Report a vulnerability

Use **Report a vulnerability** in the Security tab of this repository. That opens a private report that only the maintainers can see.

Please don't open a public issue for a security problem. Fixes are released for the latest version only.

## In short

| Question | Answer |
|----------|--------|
| Does it see my GitHub password or token? | No. Sign-in happens in Git Credential Manager's own window, and tokens stay in your operating system's credential store. |
| Does it send anything over the network? | No. It has no update check, no telemetry, and no API calls. |
| Does it need administrator rights? | No. On Windows it installs for the current user only. On macOS you drag it to Applications, or to the Applications folder inside your home folder. |
| Does it change my global git config? | Only when you add a folder or owner rule, and it asks first. Your global name, email, and credential settings are never changed. |
| Is the installer signed? | Not with a certificate yet. Windows SmartScreen warns about the installer. On macOS the app is only signed ad hoc and not notarized, so Gatekeeper asks you to allow it once. Check the download against its SHA-256 before running it. |

## What it stores

Everything the app keeps for itself is in `%APPDATA%\git-account-switcher` on Windows and in `~/Library/Application Support/git-account-switcher` on macOS. The folder carries the app's first name and stays there, because the rules in your git config point into it.

| File | Contents | Secrets |
|------|----------|---------|
| `state.json` | For each account: label, commit name, commit email, GitHub username, and the path of its SSH key. The list of project folders you added, in the order you gave them. Your settings: language, theme, and whether the guided tour was already shown. | None |
| `accounts/<id>.gitconfig` | The settings a rule applies: name, email, GitHub username, SSH command | None |

Both are plain text and not encrypted. They hold no secrets, but they do hold your email addresses and folder paths. Anyone who can read your user profile can read them.

The same folder holds the browser profile that Electron creates (caches and preferences). The app puts none of your data there.

## What it changes on your computer

| What | Where | When |
|------|-------|------|
| The account of one project | `.git/config` inside that project: `user.name`, `user.email`, `credential.https://github.com.username`, `core.sshCommand`, and `accountswitcher.*` notes | When you choose an account in the project's dropdown |
| A folder or owner rule | Your global git config: one `includeIf` entry per folder, three per owner, each pointing to a file in `accounts/` | When you add a rule and confirm it |
| A new SSH key | `~/.ssh/id_ed25519_<label>` and its `.pub` file | When you press **Generate** |
| The clipboard | The public key | When you press **Copy** |
| The clipboard | The versions of the app, Git, Git Credential Manager, Electron, and your operating system. No path, name, or email. | When you press **Copy versions** in Info |

Every change can be undone from the app. Choosing the first option of a project's dropdown puts back the values the project had before. Removing a rule removes its entries and leaves the rest of the global config exactly as it was, which the test suite checks byte for byte.

The app recognizes its own rules by where they point. It never edits or removes an include that you wrote yourself.

## What it never touches

- Passwords, personal access tokens, and OAuth tokens. It never asks git for a stored credential.
- Private keys. It stores the path of a key and reads only the matching `.pub` file.
- Your global `user.name`, `user.email`, and credential helper settings.
- Remotes, branches, commits, and the contents of your repositories.

Remote URLs that embed a password or token are detected. The app warns about them and shows the URL with the secret removed.

## SSH keys

Keys made with **Generate** are ed25519 and have no passphrase, so that the app never handles a secret. A key without a passphrase can be used by anyone who can read the file.

The file is created by your system's `ssh-keygen`, which restricts it to your own user. On Windows the file is readable by your account, administrators, and the system, and by no other user. On macOS only your user can read it. To add a passphrase:

```bash
ssh-keygen -p -f ~/.ssh/id_ed25519_work
```

**Generate** never replaces an existing file.

## Programs it runs

The app does its work by running programs you already have. It passes arguments directly, without a shell, so nothing you type is interpreted as a command.

| Program | Used for | Network |
|---------|----------|---------|
| `git` | Reading and writing configuration, finding the root of a repository, reading its version | None |
| `git credential-manager` | Listing which accounts are signed in, reading its version | None |
| `git credential-manager` | Starting a sign-in when you press **Sign in** | Yes: Git Credential Manager talks to GitHub in its own window |
| `ssh-keygen` | Creating a key when you press **Generate** | None |

These programs are found through your `PATH`. The app trusts the `git` on your computer in the same way your terminal does. On macOS, an app opened from the Finder only gets the system folders in its `PATH`, so the app adds `/opt/homebrew/bin` and `/usr/local/bin` in front when they are missing, the way your terminal has them.

One setting, `core.sshCommand`, is run by git through a shell. The app writes the key path inside single quotes, where nothing is interpreted, and refuses paths with control characters. The test suite covers paths that contain quotes and shell syntax.

## How the window is isolated

The window shows a page that ships with the app and loads nothing from the internet.

- The page runs in a sandbox with no access to Node.js, the file system, or other programs.
- It can call 19 named functions in the main process, one per action in the app. It has no general channel to the main process.
- A Content Security Policy blocks everything by default and allows only the scripts and styles shipped with the app. Inline scripts are not allowed.
- Navigation and new windows are blocked, and every browser permission request (camera, location, notifications) is refused.
- Values read from git configuration are shown as text and never parsed as HTML.

In the packaged app, Electron is configured so that it cannot be used as a general Node.js runtime: `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, and the `--inspect` flags are disabled, and code is only loaded from the app's own archive.

## Dependencies

The app has no runtime dependencies. The installed program contains its own source and Electron, and nothing else from npm.

Building it uses two development tools, `electron` and `electron-builder`. Electron is listed as a development dependency, but it is what the installed app runs on, so its advisories apply to the app. `npm audit --omit=dev` leaves it out; read the full `npm audit` instead.

At the time of writing, the app ships Electron 44.9.3, and `npm audit` reports no advisories for it. The advisories it does report (in `undici`, `fast-uri`, and `sprintf-js`) are in libraries that download Electron when you run `npm install` and that `electron-builder` uses during a build. None of them is part of the installed app.

## Verify a download

Each release lists the SHA-256 of its installers. Compare it with the file you downloaded before you run it.

```powershell
Get-FileHash .\CommitHats-Setup-*.exe -Algorithm SHA256
```

On macOS:

```bash
shasum -a 256 CommitHats-*.dmg
```

You can also build the installer yourself from the source:

```bash
npm install
npm run dist
```

It builds for the system it runs on. The result is written to `dist/`, with its checksum in `dist/SHA256SUMS.txt`.

## Known limits

- **The installer is not code-signed with a certificate.** Windows SmartScreen shows a warning the first time you run it. On macOS the app is signed ad hoc, which keeps its files from being changed unnoticed but does not say who made it, and it is not notarized by Apple. Verify the checksum, or build from source.
- **There is no automatic update.** You install a new version by downloading it.
- **Generated keys have no passphrase.** See "SSH keys" above.
- **The app's files are not encrypted.** They contain no secrets, but they are readable by anything that runs as your user. So is your git configuration.
- **A rule applies to every repository that matches it.** An owner rule matches any repository whose remote URL names that owner, including one you did not create. The account's SSH command is then used for every SSH connection git makes from that repository, not only for connections to github.com. Public-key authentication never reveals your private key to a server.
- **Anything running as your user can change the same files.** The app does not protect against other software on your account, and neither does git.
- **Only Windows and macOS are tested.** Linux is untested.
