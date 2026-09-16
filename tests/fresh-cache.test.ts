import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
  unlink,
  copyFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import {
  collectFreshInputs,
  readFreshCache,
  fingerprintRuntimeFiles,
} from '../src/codekg/fresh-cache.js';
import { freshGraph } from '../src/codekg/fresh.js';
import { extractionStats } from '../src/codekg/structural.js';
import { extractProjectGraph, hashProjectGraph } from '../src/codekg/graph.js';
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'codekg-full-cache-'));
  roots.push(root);
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src/a.ts'), 'export function a(){return 1}\n');
  return root;
}
it('reuses only exact source/discovery/module/runtime inputs and verified graph bytes', async () => {
  const root = await fixture();
  const first = await freshGraph(root, { writeCache: false });
  const input = await collectFreshInputs(root);
  expect(await readFreshCache(root, input)).toEqual(first);
  expect(hashProjectGraph(first)).toBe(
    hashProjectGraph(await extractProjectGraph(root)),
  );
  await writeFile(join(root, 'src/a.ts'), 'export function a(){return 2}\n');
  expect(await readFreshCache(root, await collectFreshInputs(root))).toBe(null);
  const edited = await freshGraph(root, { writeCache: false });
  expect(hashProjectGraph(edited)).not.toBe(hashProjectGraph(first));
  await writeFile(join(root, 'src/b.ts'), 'export const b=2;\n');
  expect(await readFreshCache(root, await collectFreshInputs(root))).toBe(null);
  await freshGraph(root, { writeCache: false });
  await unlink(join(root, 'src/b.ts'));
  expect(await readFreshCache(root, await collectFreshInputs(root))).toBe(null);
  await freshGraph(root, { writeCache: false });
  const data = join(root, '.code-kg/cache/fresh-graph-v1.json');
  await writeFile(data, '{}');
  expect(await readFreshCache(root, await collectFreshInputs(root))).toBe(null);
  const repaired = await freshGraph(root, { writeCache: false });
  expect(hashProjectGraph(repaired)).toBe(hashProjectGraph(edited));
  const meta = join(root, '.code-kg/cache/fresh-graph-v1.meta.json');
  const m = JSON.parse(await readFile(meta, 'utf8'));
  m.version = 999;
  await writeFile(meta, JSON.stringify(m));
  expect(await readFreshCache(root, await collectFreshInputs(root))).toBe(null);
}, 60000);
it('invalidates ancestor go.mod existence/bytes and rechecks symlink containment', async () => {
  const root = await fixture();
  await writeFile(join(root, 'src/a.go'), 'package demo\nfunc Hello() {}\n');
  const a = await collectFreshInputs(root);
  await writeFile(join(root, 'go.mod'), 'module example.com/one\n');
  const b = await collectFreshInputs(root);
  expect(b.key).not.toBe(a.key);
  await writeFile(join(root, 'go.mod'), 'module example.com/two\n');
  expect((await collectFreshInputs(root)).key).not.toBe(b.key);
  await freshGraph(root, { writeCache: false });
  const outside = await fixture();
  await unlink(join(root, 'src/a.ts'));
  await symlink(join(outside, 'src/a.ts'), join(root, 'src/a.ts'));
  await expect(collectFreshInputs(root)).rejects.toThrow('symlink escapes');
  expect(
    (await freshGraph(root, { writeCache: false })).analysis.parse_errors.join(
      '\n',
    ),
  ).toContain('symlink escapes');
}, 60000);
it('implementation fingerprint detects same-length code changes without mtime reliance', async () => {
  const root = await fixture();
  const file = join(root, 'runtime.js');
  await writeFile(file, 'export const version=1;');
  const before = await fingerprintRuntimeFiles([file]);
  await writeFile(file, 'export const version=2;');
  expect(await fingerprintRuntimeFiles([file])).not.toBe(before);
});

it('portable extraction provenance is generated from bytes and invalidates runtime or cache tampering', async () => {
  const root = await fixture();
  const next = await fixture();
  await freshGraph(root, { writeCache: false });
  await mkdir(join(next, '.code-kg/cache'), { recursive: true });
  for (const file of ['extraction-v1.json', 'extraction-runtime.json'])
    await copyFile(
      join(root, '.code-kg/cache', file),
      join(next, '.code-kg/cache', file),
    );
  await freshGraph(next, { writeCache: false });
  expect(extractionStats(next)).toEqual({ parsed: 0, reused: 1 });
  const metaPath = join(next, '.code-kg/cache/extraction-runtime.json');
  const meta = JSON.parse(await readFile(metaPath, 'utf8'));
  meta.runtime = 'not-current-runtime';
  await writeFile(metaPath, JSON.stringify(meta));
  await rm(join(next, '.code-kg/cache/fresh-graph-v1.meta.json'));
  await freshGraph(next, { writeCache: false });
  expect(extractionStats(next)).toEqual({ parsed: 1, reused: 0 });
  await rm(join(next, '.code-kg/cache/fresh-graph-v1.meta.json'));
  const extractionPath = join(next, '.code-kg/cache/extraction-v1.json');
  await writeFile(
    extractionPath,
    (await readFile(extractionPath, 'utf8')) + ' ',
  );
  await freshGraph(next, { writeCache: false });
  expect(extractionStats(next)).toEqual({ parsed: 1, reused: 0 });
}, 60000);
