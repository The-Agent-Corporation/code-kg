import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import { codeKgCheckCommand } from '../src/codekg/check.js';
import { plainStyler } from '../src/context.js';
import type { MaterializationManifest } from '../src/codekg/types.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const NOTES = `# Notes
<!-- reviewed by hand -->

Hand-written notes about [[architecture]]. A second sentence.

## Detail

Detail paragraph.
`;

describe('hand-written knowledge files', () => {
  it('are listed in the generated root index and left untouched', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codekg-curated-'));
    roots.push(root);
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'index.ts'), 'export const a = 1;\n');
    await writeBootstrapPlan(await createBootstrapPlan(root));
    await writeFile(join(root, 'lat.md', 'notes.md'), NOTES);
    await mkdir(join(root, 'lat.md', 'guides'), { recursive: true });
    await writeFile(
      join(root, 'lat.md', 'guides', 'guides.md'),
      '# Guides\n\nHow-to guides.\n',
    );

    const result = await writeBootstrapPlan(await createBootstrapPlan(root));
    const index = await readFile(join(root, 'lat.md', 'lat.md'), 'utf-8');
    const manifest = JSON.parse(
      await readFile(
        join(root, '.code-kg', 'materialization-manifest.json'),
        'utf-8',
      ),
    ) as MaterializationManifest;
    const check = await codeKgCheckCommand({
      latDir: join(root, 'lat.md'),
      projectRoot: root,
      styler: plainStyler,
      mode: 'cli',
    });

    expect(index).toContain(
      '- [[tests]] - Test layout and validation notes.\n' +
        '- [[guides]] - How-to guides.\n' +
        '- [[notes]] - Hand-written notes about [[architecture]].\n',
    );
    expect(result).toContain('updated lat.md/lat.md');
    expect(manifest.sections.lat.status).toBe('generated');
    expect(Object.keys(manifest.sections)).not.toContain('notes');
    expect(await readFile(join(root, 'lat.md', 'notes.md'), 'utf-8')).toBe(
      NOTES,
    );
    expect(check.isError, check.output).toBeFalsy();
  });

  it('leave ignored files and directories without an index out of the root index', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codekg-curated-'));
    roots.push(root);
    const lat = join(root, 'lat.md');
    const ctx = {
      latDir: lat,
      projectRoot: root,
      styler: plainStyler,
      mode: 'cli' as const,
    };
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'index.ts'), 'export const a = 1;\n');
    await writeBootstrapPlan(await createBootstrapPlan(root));
    await writeFile(join(lat, '.gitignore'), 'local.md\nprivate/private.md\n');
    await writeFile(join(lat, 'local.md'), '# Local\n\nSecret local notes.\n');
    await mkdir(join(lat, 'private'));
    await writeFile(
      join(lat, 'private', 'private.md'),
      '# Private\n\nPrivate index.\n',
    );

    await writeBootstrapPlan(await createBootstrapPlan(root));
    const ignored = await readFile(join(lat, 'lat.md'), 'utf-8');
    const ignoredCheck = await codeKgCheckCommand(ctx);
    await mkdir(join(lat, 'drafts'));
    await writeFile(join(lat, 'drafts', 'idea.md'), '# Idea\n\nAn idea.\n');
    await writeBootstrapPlan(await createBootstrapPlan(root));
    const unindexed = await readFile(join(lat, 'lat.md'), 'utf-8');
    const unindexedCheck = await codeKgCheckCommand(ctx);

    for (const index of [ignored, unindexed]) {
      expect(index).not.toContain('[[local]]');
      expect(index).not.toContain('Secret local notes');
      expect(index).not.toContain('[[private]]');
      expect(index).not.toContain('[[drafts]]');
    }
    expect(ignoredCheck.isError, ignoredCheck.output).toBeFalsy();
    expect(unindexedCheck.output).toContain(
      'missing index file "drafts/drafts.md"',
    );
  });
});
