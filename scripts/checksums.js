// Writes the SHA-256 of every installer in dist/, so a download can be checked against it.
// The format is the one `sha256sum --check` reads.

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

// The Windows installer and the macOS disk images.
const INSTALLER_EXTENSIONS = ['.exe', '.dmg'];

const installers = (await readdir(dist)).filter((name) => INSTALLER_EXTENSIONS.includes(path.extname(name))).sort();
if (installers.length === 0) {
  console.error('No installer found in dist/. Run the build first.');
  process.exit(1);
}

const lines = [];
for (const name of installers) {
  const hash = createHash('sha256')
    .update(await readFile(path.join(dist, name)))
    .digest('hex');
  lines.push(`${hash}  ${name}`);
}

await writeFile(path.join(dist, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
