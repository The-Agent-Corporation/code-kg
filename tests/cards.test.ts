import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import { testDeclarations } from '../src/codekg/cards.js';
import { ask } from '../src/codekg/query.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const FILES: Record<string, string> = {
  'src/store.ts': [
    '/** Durable storage for the [[cache]] of saved records. */',
    '',
    "import { log } from './log.js';",
    '',
    '/**',
    ' * Write a record through a temporary file and rename it into place.',
    ' * @param path where the record goes',
    ' */',
    '// @lat: [[lat.md/notes#Notes]]',
    'export function saveRecord(path: string) {',
    '  log(path);',
    '}',
    '',
    'export function loadRecord() {',
    '  return null;',
    '}',
    '',
  ].join('\n'),
  'src/log.ts': [
    '// Logs one line.',
    'export function log(line: string) {',
    '  console.log(line);',
    '}',
    '',
  ].join('\n'),
  'src/cli.ts': [
    "import { Command } from 'commander';",
    "import { saveRecord, loadRecord } from './store.js';",
    "import { log } from './log.js';",
    '',
    'const program = new Command();',
    "program.name('rec');",
    'const records = program',
    "  .command('records')",
    "  .description('Manage saved records');",
    'records',
    "  .command('save')",
    "  .description('Save a record (atomically)')",
    "  .action(() => { saveRecord('x'); log('saved'); });",
    "records.command('load').action(() => loadRecord());",
    ...Array.from(
      { length: 6 },
      (_, i) => `program.command('noise${i}').action(() => log('${i}'));`,
    ),
    '',
  ].join('\n'),
  'src/mcp.ts': [
    "import { loadRecord } from './store.js';",
    'export function serve(server: any) {',
    '  server.tool(',
    "    'rec_load',",
    "    'Load the saved record',",
    '    {},',
    '    async () => loadRecord(),',
    '  );',
    '}',
    '',
  ].join('\n'),
  'tests/store.test.ts': [
    "import { describe, it } from 'vitest';",
    "import { saveRecord } from '../src/store.js';",
    '',
    "describe('saveRecord', () => {",
    "  it('writes the file', () => {",
    "    saveRecord('a');",
    '  });',
    '});',
    "it('runs outside a suite', () => {});",
    '',
  ].join('\n'),
  'tests/cases/sample/app.ts': 'export const fixture = 1;\n',
  'lat.md/notes.md': '# Notes\n\nNotes about the store.\n',
};

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'codekg-cards-'));
  roots.push(root);
  for (const [path, content] of Object.entries(FILES)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

function card(files: string, path: string): string {
  const start = files.indexOf(`## ${path}\n`);
  expect(start, `card for ${path}`).toBeGreaterThanOrEqual(0);
  return files.slice(start).split(/\n(?=## )/)[0];
}

describe('file cards', () => {
  it('describe each file from its comments, commands, tests and imports', async () => {
    const root = await project();
    const plan = await createBootstrapPlan(root);
    const files = plan.files.find((f) => f.path === 'lat.md/files.md')!.content;

    const store = card(files, 'src/store.ts');
    expect(store).toContain(
      '\n\nDurable storage for the cache of saved records.',
    );
    expect(store).toContain(
      '- `saveRecord` (function): Write a record through a temporary file and rename it into place.',
    );
    expect(store).not.toContain('@param');
    expect(store).not.toContain('[[');
    expect(store).toContain('- Also defines: `loadRecord`');
    expect(store).toContain(
      '- Used by `rec records save`: Save a record (atomically)',
    );
    expect(store).toContain(
      '- Used by `rec records load`: Manage saved records',
    );
    expect(store).toContain('- Used by `MCP rec_load`: Load the saved record');
    expect(store).toContain('- Tested by: `tests/store.test.ts`');
    expect(store).toContain('- Imports: `src/log.ts`');

    const log = card(files, 'src/log.ts');
    expect(log).toContain('Source file `src/log.ts` defines `log`.');
    expect(log).toContain('- `log` (function): Logs one line.');
    expect(log).not.toContain('Used by');

    expect(card(files, 'src/cli.ts')).toContain(
      '- Registers 9 commands: `rec records`, `rec records save`, `rec records load`',
    );

    const test = card(files, 'tests/store.test.ts');
    expect(test).toContain(
      'Test file `tests/store.test.ts` checks `src/store.ts`.',
    );
    expect(test).toContain('- Test: saveRecord › writes the file');
    expect(test).toContain('- Test: runs outside a suite');

    expect(files).not.toContain('## tests/cases/sample/app.ts');
    expect(
      plan.files.find((f) => f.path === 'lat.md/lat.md')!.content,
    ).toContain('- [[files]] - One card per source and test file.');
  });

  it('scopes cards in ask by the file they describe', async () => {
    const root = await project();
    await writeBootstrapPlan(await createBootstrapPlan(root));

    const ids = async (scope?: string) =>
      (
        await ask(root, 'saved record storage', {
          semantic: false,
          source: false,
          limit: 20,
          in: scope,
        })
      ).hits
        .filter((hit) => hit.kind === 'knowledge')
        .map((hit) => hit.id);

    expect(await ids()).toContain('lat.md/files#Source Files#src/store.ts');
    expect(await ids('tests')).not.toContain(
      'lat.md/files#Source Files#src/store.ts',
    );
  });
});

describe('testDeclarations', () => {
  it('finds tests in several languages with their suites', () => {
    expect(
      testDeclarations(
        'a.test.ts',
        [
          "describe('outer', () => {",
          "  describe.skipIf(false)('inner', () => {",
          '    it.each([1])("handles %s", () => {});',
          '  });',
          "  test('after inner', () => {});",
          '});',
        ].join('\n'),
      ),
    ).toStrictEqual([
      { line: 1, name: 'outer', suites: [], suite: true },
      { line: 2, name: 'inner', suites: ['outer'], suite: true },
      { line: 3, name: 'handles %s', suites: ['outer', 'inner'] },
      { line: 5, name: 'after inner', suites: ['outer'] },
    ]);
    expect(
      testDeclarations('test_a.py', 'def test_reads():\n    pass\n'),
    ).toStrictEqual([{ line: 1, name: 'test_reads', suites: [] }]);
    expect(
      testDeclarations('a_test.go', 'func TestReads(t *testing.T) {}\n'),
    ).toStrictEqual([{ line: 1, name: 'TestReads', suites: [] }]);
  });
});
