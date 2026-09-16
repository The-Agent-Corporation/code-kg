import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createBootstrapPlan } from '../src/codekg/bootstrap.js';
import { extractProjectGraph, hashProjectGraph } from '../src/codekg/graph.js';
import { extractionStats } from '../src/codekg/structural.js';
const roots: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'codekg-bootstrap-cache-'));
  roots.push(root);
  await mkdir(join(root, 'src'));
  await writeFile(
    join(root, 'src/math.ts'),
    'export function add(a:number,b:number) { return a+b; }\r\n',
  );
  await writeFile(
    join(root, 'src/app.ts'),
    "import { add } from './math.js';\nexport function run() { return add(2,3); }\n",
  );
  return root;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
describe('bootstrap structural cache correctness', () => {
  it('seeds and reuses parsed files without changing the graph, and reparses changed bytes', async () => {
    const root = await fixture();
    const uncachedRoot = await fixture();
    const baseline = await extractProjectGraph(uncachedRoot);
    const first = await createBootstrapPlan(root);
    expect(extractionStats(root)).toEqual({ parsed: 2, reused: 0 });
    expect(first.graph).toEqual(baseline);
    const cache = JSON.parse(
      await readFile(join(root, '.code-kg/cache/extraction-v1.json'), 'utf8'),
    );
    expect(Object.keys(cache.files).sort()).toEqual([
      'src/app.ts',
      'src/math.ts',
    ]);
    const second = await createBootstrapPlan(root);
    expect(extractionStats(root)).toEqual({ parsed: 0, reused: 2 });
    expect(hashProjectGraph(second.graph)).toBe(hashProjectGraph(baseline));
    const changed =
      'export function add(a:number,b:number) { return a+b+1; }\r\n';
    await writeFile(join(root, 'src/math.ts'), changed);
    const third = await createBootstrapPlan(root);
    expect(extractionStats(root)).toEqual({ parsed: 1, reused: 1 });
    expect(hashProjectGraph(third.graph)).not.toBe(hashProjectGraph(baseline));
    const independentlyFresh = await fixture();
    await writeFile(join(independentlyFresh, 'src/math.ts'), changed);
    expect(third.graph).toEqual(await extractProjectGraph(independentlyFresh));
  });
});
