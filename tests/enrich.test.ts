import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichCommand } from '../src/codekg/enrich.js';
import { writeJsonAtomic } from '../src/codekg/cache.js';
import { sourceHash } from '../src/codekg/structural.js';
import { plainStyler, type CmdContext } from '../src/context.js';
import { checkSections } from '../src/cli/check.js';

const roots: string[] = [];
const original =
  '# Guide\n\nSource file `src/app.ts` provides application behavior.\n\n' +
  'Detailed retained knowledge with failure behavior and dependencies. '.repeat(
    40,
  ) +
  '\n';

async function fixture(files = ['guide.md']) {
  const root = await mkdtemp(join(tmpdir(), 'codekg-preview-'));
  roots.push(root);
  const latDir = join(root, 'lat.md');
  await mkdir(latDir);
  const sections: Record<string, unknown> = {};
  for (const file of files) {
    await writeFile(join(latDir, file), original);
    sections[file] = {
      file: 'lat.md/' + file,
      status: 'generated',
      generated_hash: sourceHash(original),
    };
  }
  await writeJsonAtomic(join(root, '.code-kg/materialization-manifest.json'), {
    sections,
  });
  vi.stubEnv('LAT_LLM_KEY', 'sk-or-test-placeholder');
  const ctx: CmdContext = {
    projectRoot: root,
    latDir,
    mode: 'cli',
    styler: plainStyler,
  };
  return ctx;
}

function completion(content: string, finishReason = 'stop') {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason: finishReason, message: { content } }],
    }),
    { status: 200 },
  );
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

describe('brief knowledge previews', () => {
  it.each([
    ['heading', '## Generated heading', 'stop'],
    ['bullet list', '- Generated bullet', 'stop'],
    ['overlong', 'Details that must not be silently cut. '.repeat(12), 'stop'],
    ['truncated', 'Partial preview.', 'length'],
    ['multiple paragraphs', 'First paragraph.\n\nSecond paragraph.', 'stop'],
  ])(
    'leaves original knowledge untouched after an invalid %s preview',
    async (_label, content, reason) => {
      const ctx = await fixture();
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        completion(content, reason),
      );
      const result = await enrichCommand(ctx);
      expect(result.isError).toBe(true);
      expect(await readFile(join(ctx.latDir, 'guide.md'), 'utf8')).toBe(
        original,
      );
    },
  );

  it('preserves detailed subsequent paragraphs when replacing a valid brief preview', async () => {
    const ctx = await fixture();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      completion('Application responsibilities and failure behavior.'),
    );
    const result = await enrichCommand(ctx);
    expect(result.isError).toBe(false);
    expect(await readFile(join(ctx.latDir, 'guide.md'), 'utf8')).toBe(
      original.replace(
        'Source file `src/app.ts` provides application behavior.',
        'Application responsibilities and failure behavior.',
      ),
    );
    expect(await checkSections(ctx.latDir)).toEqual([]);
  });

  it('reports a partial failure even when another preview succeeded', async () => {
    const ctx = await fixture(['first.md', 'second.md']);
    let calls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      ++calls === 1
        ? completion('Complete preview.')
        : completion('Partial preview.', 'length'),
    );
    const result = await enrichCommand(ctx);
    expect(result.isError).toBe(true);
    const contents = await Promise.all(
      ['first.md', 'second.md'].map((file) =>
        readFile(join(ctx.latDir, file), 'utf8'),
      ),
    );
    expect(contents.filter((text) => text === original)).toHaveLength(1);
    expect(
      contents.filter((text) => text.includes('Complete preview.')),
    ).toHaveLength(1);
  });
});
