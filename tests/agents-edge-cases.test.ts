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
  it('refuses to touch AGENTS.md with an unterminated managed block', async () => {
    const ctx = await project();
    const partial =
      '# Rules\n\n<!-- code-kg:agents:start -->\n## code-kg\n\nMy own notes below.\n';
    await writeFile(join(ctx.projectRoot, 'AGENTS.md'), partial);

    const install = await agentsCommand(ctx, { action: 'install' });
    const uninstall = await agentsCommand(ctx, { action: 'uninstall' });

    for (const result of [install, uninstall]) {
      expect(result.isError).toBe(true);
      expect(result.output).toContain('without a matching');
    }
    expect(await readFile(join(ctx.projectRoot, 'AGENTS.md'), 'utf-8')).toBe(
      partial,
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
