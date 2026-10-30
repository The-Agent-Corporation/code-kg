import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import { gapsCommand } from '../src/codekg/gaps.js';
import { extractProjectGraph } from '../src/codekg/graph.js';
import { plainStyler, type CmdContext } from '../src/context.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function project(): Promise<CmdContext> {
  const root = await mkdtemp(join(tmpdir(), 'codekg-gaps-inferred-'));
  roots.push(root);
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'tests'));
  await writeFile(join(root, 'src', 'spawned.ts'), 'export const s = 1;\n');
  await writeFile(join(root, 'src', 'built.ts'), 'export const b = 1;\n');
  await writeFile(join(root, 'src', 'imported.ts'), 'export const i = 1;\n');
  await writeFile(join(root, 'src', 'untested.ts'), 'export const u = 1;\n');
  await writeFile(
    join(root, 'tests', 'spawned.test.ts'),
    'const script = "import(\'./src/spawned.ts\')";\nexport { script };\n',
  );
  await writeFile(
    join(root, 'tests', 'built.test.ts'),
    "export const cli = 'dist/src/built.js';\n",
  );
  await writeFile(
    join(root, 'tests', 'imported.test.ts'),
    "import { i } from '../src/imported';\nexport const path = 'src/imported.ts';\nexport { i };\n",
  );
  await writeBootstrapPlan(await createBootstrapPlan(root));
  return {
    latDir: join(root, 'lat.md'),
    projectRoot: root,
    styler: plainStyler,
    mode: 'cli',
  };
}

describe('test coverage from path mentions', () => {
  it('adds INFERRED tests edges without downgrading extracted ones', async () => {
    const ctx = await project();
    const graph = await extractProjectGraph(ctx.projectRoot);
    const files = new Map(graph.nodes.map((node) => [node.id, node.label]));
    const testsEdges = Object.fromEntries(
      graph.edges
        .filter((edge) => edge.relation === 'tests')
        .map((edge) => [files.get(edge.target), edge.confidence]),
    );

    expect(testsEdges).toEqual({
      'src/spawned.ts': 'INFERRED',
      'src/built.ts': 'INFERRED',
      'src/imported.ts': 'EXTRACTED',
    });
  });

  it('stops gaps from reporting path-loaded modules as untested', async () => {
    const ctx = await project();

    const result = await gapsCommand(ctx);
    const coverage = result.output
      .split('## Files Without Test Coverage')[1]
      .split('##')[0];

    expect(coverage).toContain('`src/untested.ts`');
    expect(coverage).not.toContain('`src/spawned.ts`');
    expect(coverage).not.toContain('`src/built.ts`');
    expect(coverage).not.toContain('`src/imported.ts`');
  });
});
