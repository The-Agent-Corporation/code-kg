import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { extractProjectGraph, hashProjectGraph } from '../dist/src/codekg/graph.js';
const root = await mkdtemp(join(tmpdir(), 'codekg-hash-witness-'));
try {
  await mkdir(join(root, 'src'));
  const bodies = Array.from({length: 100}, (_,i) => `export function operation${i}(value: number) {\n${Array.from({length: 100}, (_,j) => `  const step${j} = value + ${j}; // Unicode λ ${i}`).join('\n')}\n  return step99;\n}`).join('\n');
  await writeFile(join(root,'src/large.ts'), bodies);
  await writeFile(join(root,'src/consumer.ts'), "import { operation1 } from './large.js';\r\nexport function calculate() { return operation1(2); }\r\n");
  await writeFile(join(root,'src/legacy.py'), 'class Example:\r\n    def method(self, x):\r\n        return x + 1\r\n');
  const started = performance.now();
  const graph = await extractProjectGraph(root);
  // Golden hash captured from the unmodified whole-file-split implementation.
  assert.equal(hashProjectGraph(graph), 'sha256:12b1650cb9b37ca3016642e31a4806a3522c13741babf6085cc1f527417f33eb');
  const result = { hash: hashProjectGraph(graph), nodes: graph.nodes.length, edges: graph.edges.length, errors: graph.analysis.parse_errors, bytes: Buffer.byteLength(bodies), elapsedMs: Math.round(performance.now()-started) };
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(graph));
  console.log(JSON.stringify(result));
} finally { await rm(root, {recursive:true, force:true}); }
