import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasRipgrep } from '../src/code-refs.js';
import { askCommand, grepCommand, mapCommand } from '../src/codekg/query.js';
import { InputError } from '../src/codekg/errors.js';
import { plainStyler, type CmdContext } from '../src/context.js';

const roots: string[] = [];
const ripgrepInstalled = await hasRipgrep();
const cliPath = join(
  import.meta.dirname,
  '..',
  'dist',
  'src',
  'codekg',
  'cli.js',
);

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function project(): Promise<CmdContext> {
  const root = await mkdtemp(join(tmpdir(), 'codekg-input-'));
  roots.push(root);
  await mkdir(join(root, 'src'));
  await writeFile(
    join(root, 'src/a.ts'),
    'export function alpha() { return 1; }\n',
  );
  return {
    projectRoot: root,
    latDir: join(root, 'lat.md'),
    styler: plainStyler,
    mode: 'cli',
  };
}

describe('invalid query input', () => {
  it('raises InputError for empty patterns and queries and escaping scopes', async () => {
    const ctx = await project();

    await expect(grepCommand(ctx, '')).rejects.toThrow(InputError);
    await expect(askCommand(ctx, '  ')).rejects.toThrow(
      'Provide a search query.',
    );
    await expect(mapCommand(ctx, { in: '../etc' })).rejects.toThrow(InputError);
  });

  it.skipIf(!ripgrepInstalled)(
    'reports an invalid regex as such, not as missing ripgrep',
    async () => {
      const ctx = await project();

      const failure = grepCommand(ctx, '(unclosed', { regex: true });

      await expect(failure).rejects.toThrow(InputError);
      await expect(failure).rejects.toThrow(
        /^Invalid regex: .*unclosed group/s,
      );
    },
  );

  it('says ripgrep is required only when it is missing', async () => {
    const ctx = await project();
    const emptyBin = await mkdtemp(join(tmpdir(), 'codekg-no-rg-'));
    roots.push(emptyBin);
    vi.stubEnv('PATH', emptyBin);

    await expect(grepCommand(ctx, 'alpha', { regex: true })).rejects.toThrow(
      'Regex search requires ripgrep (rg) on PATH',
    );
  });

  it('prints the message without a stack trace from the CLI', async () => {
    const ctx = await project();

    const run = promisify(execFile)(process.execPath, [cliPath, 'grep', ''], {
      cwd: ctx.projectRoot,
    });

    await expect(run).rejects.toMatchObject({
      code: 1,
      stderr: 'Provide a search pattern.\n',
    });
  });
});
