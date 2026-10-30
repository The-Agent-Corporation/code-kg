import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import { buildContextInfo, formatContextInfo } from '../src/codekg/context.js';
import { gapsCommand } from '../src/codekg/gaps.js';
import { extractProjectGraph } from '../src/codekg/graph.js';
import { plainStyler, type CmdContext } from '../src/context.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const SOURCES = [
  'src/spawned.ts',
  'src/built.ts',
  'src/multiline.ts',
  'src/promisified.ts',
  'src/anchored.ts',
  'src/imported.ts',
  'src/untested.ts',
  'src/helper.ts',
  'packages/app/src/helper.ts',
];

const TESTS: Record<string, string> = {
  'tests/spawned.test.ts':
    "import { execFileSync } from 'node:child_process';\nexecFileSync(process.execPath, ['-e', \"import('./src/spawned.ts')\"]);\n",
  'tests/built.test.ts':
    "import { execFileSync } from 'node:child_process';\nexecFileSync(process.execPath, ['dist/src/built.js']);\n",
  'tests/multiline.test.ts':
    "import { spawnSync } from 'node:child_process';\nspawnSync(\n  process.execPath,\n  ['dist/src/multiline.js', '--flag'],\n);\n",
  'tests/promisified.test.ts':
    "import { execFile } from 'node:child_process';\nimport { promisify } from 'node:util';\nawait promisify(execFile)(process.execPath, [\n  '-e',\n  \"import { x } from './src/promisified.ts'; console.log(x);\",\n]);\n",
  'tests/anchored.test.ts':
    "import { join } from 'node:path';\nexport const cli = join(\n  import.meta.dirname,\n  '..',\n  'dist',\n  'src',\n  'anchored.js',\n);\n",
  'tests/imported.test.ts':
    "import { i } from '../src/imported';\nexport { i };\n",
  'tests/mentions.test.ts': [
    "import { vi } from 'vitest';",
    '// spawn() used to run src/untested.ts here',
    "vi.mock('../src/untested.ts', () => ({}));",
    "await writeFile(join(root, 'src/untested.ts'), '');",
    "expect(output).toContain('src/untested.ts');",
    `expect(output).toContain("import('../src/untested.ts')");`,
    `const unused = 1; // import('../src/untested.ts')`,
    `const later = 2; /* execSync('node src/untested.ts') */`,
    `await writeFile(join(root, 'fixture.js'), "import('../src/untested.ts')");`,
    `const quotes = /['"]/; expect(output).toContain("require('../src/untested.ts')");`,
    `const resolved = require.resolve('../src/untested.ts');`,
    `const script = "import('../src/untested.ts')";`,
    '',
  ].join('\n'),
  'packages/app/tests/helper.test.ts':
    "import { spawnSync } from 'node:child_process';\nspawnSync('node', ['-e', \"import('../src/helper.ts')\"]);\n",
};

async function project(): Promise<CmdContext> {
  const root = await mkdtemp(join(tmpdir(), 'codekg-gaps-inferred-'));
  roots.push(root);
  const files = {
    ...Object.fromEntries(
      SOURCES.map((path) => [path, 'export const x = 1;\n']),
    ),
    ...TESTS,
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, dirname(path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  await writeBootstrapPlan(await createBootstrapPlan(root));
  return {
    latDir: join(root, 'lat.md'),
    projectRoot: root,
    styler: plainStyler,
    mode: 'cli',
  };
}

function section(output: string, heading: string): string {
  return output.split(`## ${heading}`)[1].split('\n## ')[0];
}

describe('test coverage from path mentions', () => {
  it('infers tests edges only from evidence that a module is loaded', async () => {
    const ctx = await project();
    const graph = await extractProjectGraph(ctx.projectRoot);
    const files = new Map(graph.nodes.map((node) => [node.id, node.label]));
    const testsEdges = graph.edges
      .filter((edge) => edge.relation === 'tests')
      .map(
        (edge) =>
          `${files.get(edge.source)} -> ${files.get(edge.target)} ${edge.confidence}`,
      )
      .sort();

    expect(testsEdges).toEqual([
      'packages/app/tests/helper.test.ts -> packages/app/src/helper.ts INFERRED',
      'tests/anchored.test.ts -> src/anchored.ts INFERRED',
      'tests/built.test.ts -> src/built.ts INFERRED',
      'tests/imported.test.ts -> src/imported.ts EXTRACTED',
      'tests/multiline.test.ts -> src/multiline.ts INFERRED',
      'tests/promisified.test.ts -> src/promisified.ts INFERRED',
      'tests/spawned.test.ts -> src/spawned.ts INFERRED',
    ]);
  });

  it('lists inferred-only coverage separately in gaps', async () => {
    const ctx = await project();

    const result = await gapsCommand(ctx);
    const untested = section(result.output, 'Files Without Test Coverage');
    const inferred = section(
      result.output,
      'Files Covered Only By Inferred Test Edges',
    );

    expect(untested).toContain('`src/untested.ts`');
    expect(untested).toContain('`src/helper.ts`');
    expect(untested).not.toContain('`src/imported.ts`');
    expect(untested).not.toContain('`src/spawned.ts`');
    for (const path of ['src/spawned.ts', 'src/built.ts', 'src/anchored.ts']) {
      expect(inferred).toContain(`\`${path}\``);
    }
    expect(inferred).not.toContain('`src/imported.ts`');
  });

  it('labels inferred tests in context and the generated tests map', async () => {
    const ctx = await project();
    const graph = await extractProjectGraph(ctx.projectRoot);

    const context = formatContextInfo(
      (await buildContextInfo(ctx, 'src/spawned.ts', graph))!,
    );
    const plan = await createBootstrapPlan(ctx.projectRoot);
    const testsMap = plan.files.find(
      (file) => file.path === 'lat.md/tests/tests.md',
    )!.content;

    expect(context).toContain(
      '- tested by: `tests/spawned.test.ts` (inferred)',
    );
    expect(testsMap).toContain(
      '- Inferred tests (load it by path, not by import): `tests/spawned.test.ts`',
    );
    expect(testsMap).toContain('- Tests: `tests/imported.test.ts`');
  });
});
