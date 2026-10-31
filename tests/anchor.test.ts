import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { anchorCommand } from '../src/codekg/anchor.js';
import { manifestOwner } from '../src/codekg/anchors.js';
import { applyBacklinksCommand } from '../src/codekg/backlinks.js';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import { codeKgCheckCommand } from '../src/codekg/check.js';
import { contextCommand } from '../src/codekg/context.js';
import { driftCommand } from '../src/codekg/drift.js';
import { createCodeKgMcpServer } from '../src/codekg/mcp.js';
import { reviewSourceCommand } from '../src/codekg/review-source.js';
import type {
  ManifestSection,
  MaterializationManifest,
} from '../src/codekg/types.js';
import { plainStyler, type CmdContext } from '../src/context.js';

const roots: string[] = [];
const SECTION = 'lat.md/notes#Notes#Greeting';
const GREET =
  'export function greet(name: string) {\n  return `hi ${name}`;\n}\n\nexport function wave() {\n  return 1;\n}\n';

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function ctx(root: string): CmdContext {
  return {
    latDir: join(root, 'lat.md'),
    projectRoot: root,
    styler: plainStyler,
    mode: 'cli',
  };
}

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'codekg-anchor-'));
  roots.push(root);
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src/greet.ts'), GREET);
  await writeFile(
    join(root, 'src/other.ts'),
    'export function wave() {\n  return 2;\n}\n',
  );
  await writeBootstrapPlan(await createBootstrapPlan(root));
  await writeFile(
    join(root, 'lat.md/notes.md'),
    '# Notes\n\nHand-written notes.\n\n## Greeting\n\nHow greeting works.\n',
  );
  await writeBootstrapPlan(await createBootstrapPlan(root));
  return root;
}

async function readManifest(root: string): Promise<MaterializationManifest> {
  return JSON.parse(
    await readFile(
      join(root, '.code-kg/materialization-manifest.json'),
      'utf-8',
    ),
  ) as MaterializationManifest;
}

const add = (root: string, section: string, target: string) =>
  anchorCommand(ctx(root), section, { action: 'add', target });

describe('code-kg anchor', () => {
  it('anchors a hand-written section and follows the symbol when the source moves', async () => {
    const root = await project();

    const added = await add(root, 'notes#Greeting', 'src/greet.ts#greet');
    await writeFile(join(root, 'src/greet.ts'), '// moved down\n\n' + GREET);
    const applied = await applyBacklinksCommand(ctx(root), { write: true });

    expect(added.isError).toBeFalsy();
    expect(added.output).toContain(
      `Anchored ${SECTION} to src/greet.ts#greet at src/greet.ts:1.`,
    );
    expect((await readManifest(root)).sections[SECTION]).toMatchObject({
      status: 'curated',
      source_anchor_policy: 'edit-safe',
      source_spans: [],
      source_anchors: [{ file: 'src/greet.ts', symbol: 'greet' }],
    });
    expect(applied.output).toContain(
      `inserted // @lat: [[${SECTION}]] at src/greet.ts:3`,
    );
    expect(await readFile(join(root, 'src/greet.ts'), 'utf-8')).toBe(
      `// moved down\n\n// @lat: [[${SECTION}]]\n` + GREET,
    );
    expect((await codeKgCheckCommand(ctx(root))).isError).toBeFalsy();
  });

  it('keeps section anchors through code-kg update', async () => {
    const root = await project();
    await add(root, SECTION, 'greet');
    const before = (await readManifest(root)).sections[SECTION];

    await writeBootstrapPlan(await createBootstrapPlan(root));

    expect((await readManifest(root)).sections[SECTION]).toStrictEqual(before);
  });

  it('refuses sections of generated files', async () => {
    const root = await project();

    for (const section of [
      'lat.md/architecture#Architecture',
      'Entry Points',
    ]) {
      const result = await add(root, section, 'greet');
      expect(result.isError).toBe(true);
      expect(result.output).toContain('lat.md/architecture.md is generated');
    }
    expect(Object.keys((await readManifest(root)).sections)).not.toContain(
      'lat.md/architecture#Architecture#Entry Points',
    );
    const list = await anchorCommand(ctx(root), 'Entry Points', {
      action: 'list',
    });
    expect(list.isError).toBeFalsy();
    expect(list.output).toContain(
      'lat.md/architecture#Architecture#Entry Points has no source anchors. lat.md/architecture.md is generated',
    );
  });

  it('lets an entry whose heading was renamed be listed and removed by its key', async () => {
    const root = await project();
    await add(root, SECTION, 'greet');
    await writeFile(
      join(root, 'lat.md/notes.md'),
      '# Notes\n\nHand-written notes.\n\n## Greetings\n\nHow greeting works.\n',
    );

    const check = await codeKgCheckCommand(ctx(root));
    const list = await anchorCommand(ctx(root), SECTION, { action: 'list' });
    const added = await add(root, SECTION, 'src/other.ts#wave');
    const removed = await anchorCommand(ctx(root), SECTION, {
      action: 'remove',
      target: 'greet',
    });

    expect(check.output).toContain(
      `Manifest section ${SECTION} points to missing section ${SECTION}. Restore the heading, or drop the entry by removing its anchors: code-kg anchor "${SECTION}" --remove "`,
    );
    expect(list.output).toContain('- src/greet.ts#greet at src/greet.ts:1');
    expect(added.isError).toBe(true);
    expect(added.output).toContain(`No section matches ${SECTION}.`);
    expect(removed.output).toContain(
      `Removed anchor src/greet.ts#greet from ${SECTION}.`,
    );
    expect((await readManifest(root)).sections[SECTION]).toBeUndefined();
    expect((await codeKgCheckCommand(ctx(root))).isError).toBeFalsy();
  });

  it('anchors a curated file entry and keeps it when the anchor is removed', async () => {
    const root = await project();
    await reviewSourceCommand(ctx(root), 'architecture', true);

    await add(root, 'lat.md/architecture#Architecture', 'greet');
    const anchored = (await readManifest(root)).sections.architecture;
    await anchorCommand(ctx(root), 'architecture', {
      action: 'remove',
      target: 'src/greet.ts#greet',
    });
    const removed = (await readManifest(root)).sections.architecture;

    expect(anchored.source_anchor_policy).toBe('edit-safe');
    expect(anchored.source_anchors).toHaveLength(1);
    expect(removed.source_anchor_policy).toBe('coverage-only');
    expect(removed.source_anchors).toBeUndefined();
    expect(removed.status).toBe('curated');
    expect((await codeKgCheckCommand(ctx(root))).isError).toBeFalsy();
  });

  it('stays edit-safe through its anchors when review-source drops stale spans', async () => {
    const root = await project();
    await reviewSourceCommand(ctx(root), 'architecture', true);
    await add(root, 'lat.md/architecture#Architecture', 'greet');
    const manifest = await readManifest(root);
    manifest.sections.architecture.source_spans = [
      { file: 'src/other.ts', start_line: 1, end_line: 1 },
    ];
    await writeFile(
      join(root, '.code-kg/materialization-manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
    await writeFile(
      join(root, 'src/other.ts'),
      '// moved\nexport function wave() {\n  return 2;\n}\n',
    );

    const review = await reviewSourceCommand(ctx(root), 'architecture', true);
    const section = (await readManifest(root)).sections.architecture;

    expect(review.output).toContain(
      "Dropped architecture's source spans in src/other.ts",
    );
    expect(review.output).not.toContain('coverage-only');
    expect(section.source_spans).toStrictEqual([]);
    expect(section.source_anchor_policy).toBe('edit-safe');
    expect((await codeKgCheckCommand(ctx(root))).isError).toBeFalsy();
  });

  it('reports an anchor whose symbol is gone until it is removed', async () => {
    const root = await project();
    await add(root, SECTION, 'greet');
    await writeFile(
      join(root, 'src/greet.ts'),
      GREET.replace('function greet', 'function hello'),
    );

    const check = await codeKgCheckCommand(ctx(root));
    const drift = await driftCommand(ctx(root));
    const preview = await applyBacklinksCommand(ctx(root), { write: false });
    const list = await anchorCommand(ctx(root), SECTION, { action: 'list' });
    const review = await reviewSourceCommand(ctx(root), SECTION, true);
    const removed = await anchorCommand(ctx(root), SECTION, {
      action: 'remove',
      target: 'greet',
    });

    expect(drift.output).toContain(
      `- Manifest section ${SECTION} is anchored to src/greet.ts#greet, which disappeared from the fresh graph`,
    );
    expect(review.isError).toBe(true);
    expect(review.output).toContain(
      'Resolve missing source coverage before review: src/greet.ts#greet',
    );
    expect(check.isError).toBe(true);
    expect(check.output).toContain(
      `Manifest section ${SECTION} is anchored to src/greet.ts#greet, which no longer exists in the source`,
    );
    expect(preview.output).toContain(
      `skipped src/greet.ts#greet: section ${SECTION} is anchored to it, but it no longer exists in the source`,
    );
    expect(list.output).toContain(
      '- src/greet.ts#greet is missing from the source',
    );
    expect(removed.output).toContain(
      `Removed anchor src/greet.ts#greet from ${SECTION}.`,
    );
    expect((await readManifest(root)).sections[SECTION]).toBeUndefined();
    expect((await codeKgCheckCommand(ctx(root))).isError).toBeFalsy();
  });

  it('rejects malformed anchors and anchors on a coverage-only section', async () => {
    const root = await project();
    await add(root, SECTION, 'greet');
    const manifest = await readManifest(root);
    manifest.sections[SECTION].source_anchor_policy = 'coverage-only';
    manifest.sections.architecture.source_anchors = [
      { file: 'src/greet.ts' },
    ] as never;
    await writeFile(
      join(root, '.code-kg/materialization-manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );

    const check = await codeKgCheckCommand(ctx(root));

    expect(check.isError).toBe(true);
    expect(check.output).toContain(
      `Manifest section ${SECTION} is coverage-only but has source_anchors.`,
    );
    expect(check.output).toContain(
      'Manifest section architecture has invalid source_anchors; each needs a node_id, a file and a hash.',
    );
  });

  it('asks for the file when a symbol name is ambiguous', async () => {
    const root = await project();

    const ambiguous = await add(root, SECTION, 'wave');
    const scoped = await add(root, SECTION, 'src/other.ts#wave');
    const list = await anchorCommand(ctx(root), SECTION, { action: 'list' });

    expect(ambiguous.isError).toBe(true);
    expect(ambiguous.output).toContain('wave matches several symbols');
    expect(ambiguous.output).toContain('src/greet.ts#wave');
    expect(ambiguous.output).toContain('src/other.ts#wave');
    expect(scoped.isError).toBeFalsy();
    expect(list.output).toContain('- src/other.ts#wave at src/other.ts:1');
  });

  it('anchors a file and inserts its backlink at the top', async () => {
    const root = await project();
    await add(root, SECTION, 'src/other.ts');

    await applyBacklinksCommand(ctx(root), { write: true });

    expect(await readFile(join(root, 'src/other.ts'), 'utf-8')).toBe(
      `// @lat: [[${SECTION}]]\nexport function wave() {\n  return 2;\n}\n`,
    );
  });

  it('writes one backlink per file for a section anchored to two symbols in it', async () => {
    const root = await project();
    await add(root, SECTION, 'src/greet.ts#wave');
    await add(root, SECTION, 'greet');

    const applied = await applyBacklinksCommand(ctx(root), { write: true });
    const again = await applyBacklinksCommand(ctx(root), { write: true });
    const content = await readFile(join(root, 'src/greet.ts'), 'utf-8');

    expect(applied.output).toContain(
      `inserted // @lat: [[${SECTION}]] at src/greet.ts:1`,
    );
    expect(content).toBe(`// @lat: [[${SECTION}]]\n` + GREET);
    expect(again.output).not.toContain('inserted');
    expect((await driftCommand(ctx(root))).output).not.toContain(SECTION);
  });

  it('asks for review only when the anchored symbol changes, and review-source records it', async () => {
    const root = await project();
    await add(root, SECTION, 'greet');
    await writeFile(
      join(root, 'src/greet.ts'),
      GREET.replace('return 1', 'return 3'),
    );
    const unrelated = await driftCommand(ctx(root));
    await writeFile(join(root, 'src/greet.ts'), GREET.replace('hi', 'hello'));

    const stale = await driftCommand(ctx(root));
    const list = await anchorCommand(ctx(root), SECTION, { action: 'list' });
    const review = await reviewSourceCommand(ctx(root), SECTION, true);
    const fresh = await driftCommand(ctx(root));

    expect(unrelated.output).not.toContain(SECTION);
    expect(stale.output).toContain(
      `- Anchored source changed: src/greet.ts#greet; review knowledge section ${SECTION}, then run code-kg review-source "${SECTION}" --write.`,
    );
    expect(list.output).toContain(
      '- src/greet.ts#greet at src/greet.ts:1 (changed since the section was reviewed',
    );
    expect(review.output).toContain(
      `Acknowledged source review for ${SECTION} (1 anchor).`,
    );
    expect(fresh.output).not.toContain(SECTION);
    expect((await readManifest(root)).sections[SECTION]).toMatchObject({
      source_anchor_policy: 'edit-safe',
      source_node_ids: [],
      source_hashes: {},
    });
  });

  it('keeps anchor baselines current when backlinks are written into anchored code', async () => {
    const root = await project();
    await writeFile(
      join(root, 'src/shape.ts'),
      'export class Shape {\n  area() {\n    return 0;\n  }\n}\n',
    );
    await writeFile(
      join(root, 'lat.md/notes.md'),
      '# Notes\n\nHand-written notes.\n\n## Greeting\n\nHow greeting works.\n\n## Shapes\n\nHow shapes work.\n',
    );
    const shapes = 'lat.md/notes#Notes#Shapes';
    await add(root, SECTION, 'src/other.ts');
    await add(root, shapes, 'Shape');
    await add(root, SECTION, 'area');

    const applied = await applyBacklinksCommand(ctx(root), { write: true });
    const drift = await driftCommand(ctx(root));

    expect(applied.output).toContain(
      `inserted // @lat: [[${SECTION}]] at src/shape.ts:2`,
    );
    expect(applied.output).toContain(
      `inserted // @lat: [[${SECTION}]] at src/other.ts:1`,
    );
    expect(drift.output).not.toContain(SECTION);
    expect(drift.output).not.toContain(shapes);
  });

  it('skips a backlink that would land inside a literal or cannot be checked', async () => {
    const root = await project();
    const banner = 'const banner = `hello\n`; function greet() { return banner; }\n';
    await writeFile(join(root, 'src/banner.js'), banner);
    await writeFile(join(root, 'src/limit.ts'), 'export const LIMIT = 3;\n');
    await add(root, SECTION, 'src/banner.js#greet');
    await add(root, SECTION, 'LIMIT');

    const applied = await applyBacklinksCommand(ctx(root), { write: true });

    expect(applied.output).toContain(
      'skipped src/banner.js#greet: code from an earlier line continues onto its first line at src/banner.js:2',
    );
    expect(applied.output).toContain(
      'skipped src/limit.ts#LIMIT: its syntax tree was not available',
    );
    expect(await readFile(join(root, 'src/banner.js'), 'utf-8')).toBe(banner);
    expect(await readFile(join(root, 'src/limit.ts'), 'utf-8')).toBe(
      'export const LIMIT = 3;\n',
    );
  });

  it('lists anchored sections in code-kg context for the file', async () => {
    const root = await project();
    await add(root, SECTION, 'greet');

    const context = await contextCommand(ctx(root), 'src/greet.ts');

    expect(context.output).toContain(SECTION);
  });

  it('is available through MCP', async () => {
    const root = await project();
    const server = createCodeKgMcpServer(ctx(root));
    const client = new Client({ name: 'test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    await client.connect(b);
    try {
      const response = await client.callTool({
        name: 'codekg_anchor',
        arguments: { section: SECTION, target: 'src/greet.ts#greet' },
      });
      expect(response.isError).not.toBe(true);
      expect(JSON.stringify(response.content)).toContain(
        `Anchored ${SECTION} to src/greet.ts#greet`,
      );
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe('manifestOwner', () => {
  const entry = (stable_id: string, public_section_id: string) =>
    ({
      stable_id,
      public_section_id,
      file: 'lat.md/notes.md',
    }) as ManifestSection;
  const manifest = {
    sections: {
      [SECTION]: entry(SECTION, SECTION),
      notes: entry('notes', 'lat.md/notes#Notes'),
    },
  } as unknown as MaterializationManifest;

  it("prefers a section's own entry over its file's entry", () => {
    const owner = (id: string) =>
      manifestOwner(manifest, { id, filePath: 'lat.md/notes.md' })?.stable_id;

    expect(owner(SECTION)).toBe(SECTION);
    expect(owner('lat.md/notes#Notes#Other')).toBe('notes');
  });
});
