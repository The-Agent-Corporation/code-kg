import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist/src/vendor/graft');
mkdirSync(out, { recursive: true });
for (const path of ['graph/queries', 'LICENSE']) {
  cpSync(resolve(root, 'src/vendor/graft', path), resolve(out, path), {
    recursive: true,
  });
}
