import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  unlink,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { freshGraph } from '../src/codekg/fresh.js';
import { hashProjectGraph } from '../src/codekg/graph.js';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
it('lifecycle omission changes only diagnostic persistence, preserving edits, removals and containment checks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'codekg-lifecycle-'));
  roots.push(root);
  await mkdir(join(root, 'src'));
  const source = join(root, 'src/a.ts');
  await writeFile(source, 'export function add() { return 1; }\n');
  const cache = join(root, '.code-kg/cache/graph.json');
  const first = await freshGraph(root, { writeCache: false });
  expect(existsSync(cache)).toBe(false);
  expect(existsSync(join(root, '.code-kg/cache/extraction-v1.json'))).toBe(
    true,
  );
  const normal = await freshGraph(root);
  expect(hashProjectGraph(normal)).toBe(hashProjectGraph(first));
  const persisted = await readFile(cache, 'utf8');
  await writeFile(source, 'export function add() { return 2; }\n');
  const edited = await freshGraph(root, { writeCache: false });
  expect(hashProjectGraph(edited)).not.toBe(hashProjectGraph(first));
  expect(await readFile(cache, 'utf8')).toBe(persisted);
  expect(hashProjectGraph(await freshGraph(root))).toBe(
    hashProjectGraph(edited),
  );
  await unlink(source);
  expect(
    (await freshGraph(root, { writeCache: false })).nodes.some(
      (n) => n.label === 'add',
    ),
  ).toBe(false);
  const outside = await mkdtemp(join(tmpdir(), 'codekg-outside-'));
  roots.push(outside);
  await writeFile(join(outside, 'a.ts'), 'export const outside = 1;\n');
  await symlink(join(outside, 'a.ts'), source);
  const refused = await freshGraph(root, { writeCache: false });
  expect(refused.analysis.parse_errors.join('\n')).toContain(
    'source symlink escapes',
  );
  expect(hashProjectGraph(await freshGraph(root))).toBe(
    hashProjectGraph(refused),
  );
});
it('concurrent lifecycle and default requests retain default persistence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'codekg-concurrent-'));
  roots.push(root);
  await writeFile(join(root, 'a.ts'), 'export const value = 1;\n');
  const [a, b] = await Promise.all([
    freshGraph(root, { writeCache: false }),
    freshGraph(root),
  ]);
  expect(hashProjectGraph(a)).toBe(hashProjectGraph(b));
  expect(
    JSON.parse(await readFile(join(root, '.code-kg/cache/graph.json'), 'utf8')),
  ).toEqual(b);
});
