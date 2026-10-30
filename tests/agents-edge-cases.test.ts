import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { agentsCommand } from '../src/codekg/agents.js';
import { plainStyler, type CmdContext } from '../src/context.js';

const roots: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function project(): Promise<CmdContext> {
  const root = await mkdtemp(join(tmpdir(), 'codekg-agents-edge-'));
  roots.push(root);
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src', 'index.ts'), 'export const a = 1;\n');
  return {
    latDir: join(root, 'lat.md'),
    projectRoot: root,
    styler: plainStyler,
    mode: 'cli',
  };
}

describe('agents install/uninstall edge cases', () => {
  const START = '<!-- code-kg:agents:start -->';
  const END = '<!-- code-kg:agents:end -->';
  it.each([
    ['an unterminated block', `# Rules\n\n${START}\n## code-kg\n\nMy notes.\n`],
    [
      'a second start before the end',
      `${START}\nMy notes.\n${START}\n## code-kg\n${END}\n`,
    ],
    [
      'a trailing unmatched start',
      `${START}\n## code-kg\n${END}\n\nMy notes.\n${START}\n`,
    ],
    ['an end without a start', `# Rules\n${END}\nMy notes.\n`],
  ])('refuses to touch AGENTS.md with %s', async (_, malformed) => {
    const ctx = await project();
    await writeFile(join(ctx.projectRoot, 'AGENTS.md'), malformed);

    const install = await agentsCommand(ctx, { action: 'install' });
    const uninstall = await agentsCommand(ctx, { action: 'uninstall' });

    for (const result of [install, uninstall]) {
      expect(result.isError).toBe(true);
      expect(result.output).toContain('nothing was changed');
    }
    expect(await readFile(join(ctx.projectRoot, 'AGENTS.md'), 'utf-8')).toBe(
      malformed,
    );
    expect(existsSync(join(ctx.projectRoot, '.codex'))).toBe(false);
  });

  it('removes .codex/hooks.json when only Code-KG hooks were in it', async () => {
    const ctx = await project();
    await agentsCommand(ctx, { action: 'install' });
    expect(existsSync(join(ctx.projectRoot, '.codex', 'hooks.json'))).toBe(
      true,
    );

    const result = await agentsCommand(ctx, { action: 'uninstall' });

    expect(result.isError).toBeFalsy();
    expect(existsSync(join(ctx.projectRoot, '.codex'))).toBe(false);
  });

  it('keeps other top-level hook settings on uninstall', async () => {
    const ctx = await project();
    await mkdir(join(ctx.projectRoot, '.codex'));
    await writeFile(
      join(ctx.projectRoot, '.codex', 'hooks.json'),
      JSON.stringify({ version: 2 }),
    );
    await agentsCommand(ctx, { action: 'install' });

    await agentsCommand(ctx, { action: 'uninstall' });

    expect(
      JSON.parse(
        await readFile(join(ctx.projectRoot, '.codex', 'hooks.json'), 'utf-8'),
      ),
    ).toEqual({ version: 2, hooks: {} });
  });

  it('warns when hooks fall back to a machine-specific command', async () => {
    const ctx = await project();
    const emptyBin = await mkdtemp(join(tmpdir(), 'codekg-no-path-'));
    roots.push(emptyBin);
    vi.stubEnv('PATH', emptyBin);

    const result = await agentsCommand(ctx, { action: 'install' });

    expect(result.output).toContain(
      "warning: `code-kg` is not on PATH, so AGENTS.md and .codex/hooks.json use this machine's path",
    );
    expect(result.output).toContain('code-kg install-global');
  });
});
