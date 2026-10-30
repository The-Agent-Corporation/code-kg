import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import {
  applyBacklinksCommand,
  insertCommentLine,
} from '../src/codekg/backlinks.js';
import { codeKgCheckCommand } from '../src/codekg/check.js';
import { driftCommand } from '../src/codekg/drift.js';
import { reviewSourceCommand } from '../src/codekg/review-source.js';
import { sourceHash } from '../src/codekg/structural.js';
import { plainStyler, type CmdContext } from '../src/context.js';
import type {
  MaterializationManifest,
  SourceSpan,
} from '../src/codekg/types.js';

const roots: string[] = [];
const BACKLINK = '// @lat: [[lat.md/architecture#Architecture]]';

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

async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'codekg-backlinks-'));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), content);
  }
  await writeBootstrapPlan(await createBootstrapPlan(root));
  return root;
}

const manifestPath = (root: string) =>
  join(root, '.code-kg', 'materialization-manifest.json');

async function readManifest(root: string): Promise<MaterializationManifest> {
  return JSON.parse(
    await readFile(manifestPath(root), 'utf-8'),
  ) as MaterializationManifest;
}

async function markEditSafe(
  root: string,
  spans: SourceSpan[],
  key = 'architecture',
  status: 'curated' | 'suppressed' = 'curated',
): Promise<string> {
  const manifest = await readManifest(root);
  const section = manifest.sections[key];
  section.status = status;
  section.source_anchor_policy = 'edit-safe';
  section.source_spans = spans;
  section.source_hashes ??= {};
  for (const span of spans) {
    const path = join(root, span.file);
    if (!section.source_hashes[span.file] && existsSync(path)) {
      section.source_hashes[span.file] = sourceHash(
        await readFile(path, 'utf-8'),
      );
    }
  }
  await writeFile(manifestPath(root), JSON.stringify(manifest, null, 2) + '\n');
  return section.public_section_id;
}

describe('apply-backlinks --write safety', () => {
  it('preserves CRLF line endings and every other byte', async () => {
    const original =
      'export const a = 1;\r\nexport function b() {\r\n  return 2;\r\n}\r\n';
    const root = await project({ 'src/a.ts': original });
    await markEditSafe(root, [
      { file: 'src/a.ts', start_line: 2, end_line: 4 },
    ]);

    await applyBacklinksCommand(ctx(root), { write: true });

    expect(await readFile(join(root, 'src/a.ts'), 'utf-8')).toBe(
      'export const a = 1;\r\n' + BACKLINK + '\r\n' + original.slice(21),
    );
  });

  it('skips files that changed since the section recorded its spans', async () => {
    const root = await project({
      'src/a.ts': 'export function b() {\n  return 2;\n}\n',
    });
    await markEditSafe(root, [
      { file: 'src/a.ts', start_line: 2, end_line: 2 },
    ]);
    const edited =
      'export const s = `one\ntwo`;\nexport function b() {\n  return 2;\n}\n';
    await writeFile(join(root, 'src/a.ts'), edited);

    const result = await applyBacklinksCommand(ctx(root), { write: true });

    expect(result.output).toContain('skipped src/a.ts: changed since section');
    expect(result.output).not.toContain('inserted');
    expect(await readFile(join(root, 'src/a.ts'), 'utf-8')).toBe(edited);
  });

  it('refuses paths outside the project root', async () => {
    const root = await project({ 'src/a.ts': 'export const a = 1;\n' });
    const outside = join(root, '..', `outside-${roots.length}.ts`);
    roots.push(outside);
    await writeFile(outside, 'export const o = 1;\n');
    await markEditSafe(root, [
      { file: `../outside-${roots.length - 1}.ts`, start_line: 1, end_line: 1 },
    ]);

    const result = await applyBacklinksCommand(ctx(root), { write: true });

    expect(result.output).toContain('skipped path outside the project root');
    expect(await readFile(outside, 'utf-8')).toBe('export const o = 1;\n');
  });

  it('inserts one backlink per file, indented like the target line', async () => {
    const root = await project({
      'src/a.ts':
        'export class A {\n  first() {\n    return 1;\n  }\n  second() {\n    return 2;\n  }\n}\n',
    });
    await markEditSafe(root, [
      { file: 'src/a.ts', start_line: 5, end_line: 7 },
      { file: 'src/a.ts', start_line: 2, end_line: 4 },
    ]);

    await applyBacklinksCommand(ctx(root), { write: true });

    const source = await readFile(join(root, 'src/a.ts'), 'utf-8');
    expect(source.split(BACKLINK)).toHaveLength(2);
    expect(source).toContain(`export class A {\n  ${BACKLINK}\n  first() {`);
  });

  it('keeps the drift baseline in sync with its own insertion', async () => {
    const root = await project({ 'src/a.ts': 'export const a = 1;\n' });
    await markEditSafe(root, [
      { file: 'src/a.ts', start_line: 1, end_line: 1 },
    ]);

    await applyBacklinksCommand(ctx(root), { write: true });
    const drift = await driftCommand(ctx(root));

    expect(await readFile(join(root, 'src/a.ts'), 'utf-8')).toContain(BACKLINK);
    expect(drift.output).not.toContain('Source content changed: src/a.ts');
  });

  it('moves the spans of sections it skipped so a later run stays aligned', async () => {
    const root = await project({
      'src/a.ts':
        'export const a = 1;\nexport function b() {\n  return 2;\n}\n',
    });
    await markEditSafe(root, [
      { file: 'src/a.ts', start_line: 1, end_line: 1 },
    ]);
    const other = Object.keys((await readManifest(root)).sections).find(
      (key) => key !== 'architecture',
    )!;
    const otherId = await markEditSafe(
      root,
      [{ file: 'src/a.ts', start_line: 2, end_line: 4 }],
      other,
      'suppressed',
    );

    await applyBacklinksCommand(ctx(root), { write: true });
    expect(
      (await readManifest(root)).sections[other].source_spans,
    ).toStrictEqual([{ file: 'src/a.ts', start_line: 3, end_line: 5 }]);

    const manifest = await readManifest(root);
    manifest.sections[other].status = 'curated';
    await writeFile(manifestPath(root), JSON.stringify(manifest, null, 2));
    await applyBacklinksCommand(ctx(root), { write: true });

    expect(await readFile(join(root, 'src/a.ts'), 'utf-8')).toBe(
      `${BACKLINK}\nexport const a = 1;\n// @lat: [[${otherId}]]\nexport function b() {\n  return 2;\n}\n`,
    );
  });

  it('does not trust stale spans after review-source --write refreshes hashes', async () => {
    const root = await project({
      'src/a.ts': 'export function b() {\n  return 2;\n}\n',
    });
    await markEditSafe(root, [
      { file: 'src/a.ts', start_line: 2, end_line: 2 },
    ]);
    const shifted =
      'export const s = `one\ntwo`;\nexport function b() {\n  return 2;\n}\n';
    await writeFile(join(root, 'src/a.ts'), shifted);

    const review = await reviewSourceCommand(ctx(root), 'architecture', true);
    const result = await applyBacklinksCommand(ctx(root), { write: true });
    const section = (await readManifest(root)).sections.architecture;

    expect(review.isError).toBeFalsy();
    expect(review.output).toContain(
      "Dropped architecture's source spans in src/a.ts: they were recorded against older content. With no spans left, it is now coverage-only.",
    );
    expect(section.source_anchor_policy).toBe('coverage-only');
    expect(section.source_spans).toStrictEqual([]);
    expect((await codeKgCheckCommand(ctx(root))).isError).toBeFalsy();
    expect(result.output).toContain('No backlink changes.');
    expect(await readFile(join(root, 'src/a.ts'), 'utf-8')).toBe(shifted);
  });

  it('drops only the stale spans when review-source --write refreshes hashes', async () => {
    const root = await project({
      'src/a.ts': 'export const a = 1;\n',
      'src/b.ts': 'export const b = 2;\n',
    });
    const fresh = { file: 'src/b.ts', start_line: 1, end_line: 1 };
    await markEditSafe(root, [
      { file: 'src/a.ts', start_line: 1, end_line: 1 },
      fresh,
    ]);
    await writeFile(join(root, 'src/a.ts'), '// moved\nexport const a = 1;\n');

    const review = await reviewSourceCommand(ctx(root), 'architecture', true);
    const section = (await readManifest(root)).sections.architecture;

    expect(review.output).toContain(
      "Dropped architecture's source spans in src/a.ts: they were recorded against older content.",
    );
    expect(review.output).not.toContain('coverage-only');
    expect(section.source_anchor_policy).toBe('edit-safe');
    expect(section.source_spans).toStrictEqual([fresh]);
    expect((await codeKgCheckCommand(ctx(root))).isError).toBeFalsy();
  });

  it('keeps an edit-safe section whose spans still match after review-source', async () => {
    const root = await project({ 'src/a.ts': 'export const a = 1;\n' });
    await markEditSafe(root, [
      { file: 'src/a.ts', start_line: 1, end_line: 1 },
    ]);

    const review = await reviewSourceCommand(ctx(root), 'architecture', true);

    expect(review.output).not.toContain('coverage-only');
    expect(
      (await readManifest(root)).sections.architecture.source_anchor_policy,
    ).toBe('edit-safe');
  });

  it('keeps a shebang and an encoding declaration on the first lines', async () => {
    const header = '#!/usr/bin/env python3\n# -*- coding: utf-8 -*-\n';
    const root = await project({ 'bin/run.py': `${header}print(1)\n` });
    await markEditSafe(root, [
      { file: 'bin/run.py', start_line: 1, end_line: 3 },
    ]);

    const result = await applyBacklinksCommand(ctx(root), { write: true });

    expect(result.output).toContain('at bin/run.py:3');
    expect(await readFile(join(root, 'bin/run.py'), 'utf-8')).toBe(
      `${header}# @lat: [[lat.md/architecture#Architecture]]\nprint(1)\n`,
    );
  });

  it.each([
    ['a banner comment', '# Build helper\n# coding: latin-1\nprint(1)\n', 3],
    ['a blank line', '\n# -*- coding: utf-8 -*-\nprint(1)\n', 3],
    ['a CRLF banner', '# Build helper\r\n# coding=utf-8\r\nprint(1)\r\n', 3],
    ['code', 'x = 1\n# coding: utf-8\nprint(1)\n', 1],
  ])(
    'keeps a line-2 encoding declaration after %s only when Python honors it',
    async (_, source, line) => {
      const root = await project({ 'bin/run.py': source });
      await markEditSafe(root, [
        { file: 'bin/run.py', start_line: 1, end_line: 3 },
      ]);

      const result = await applyBacklinksCommand(ctx(root), { write: true });

      expect(result.output).toContain(`at bin/run.py:${line}`);
    },
  );
});

describe('insertCommentLine', () => {
  it('appends past the end of a file without a trailing newline', () => {
    expect(insertCommentLine('a\nb', 9, '// c')).toBe('a\nb\n// c\n');
  });

  it('inserts before the first line', () => {
    expect(insertCommentLine('a\r\nb\r\n', 1, '// c')).toBe(
      '// c\r\na\r\nb\r\n',
    );
  });
});
