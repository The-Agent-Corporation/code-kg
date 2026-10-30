import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import { codeKgSearchCommand } from '../src/codekg/search.js';
import { flattenSections, loadAllSections } from '../src/lattice.js';
import { plainStyler, type CmdContext } from '../src/context.js';

const semantic = vi.hoisted(() => ({ searchSections: vi.fn() }));

vi.mock('../src/search/search.js', () => ({
  searchSections: semantic.searchSections,
}));
vi.mock('../src/search/index.js', () => ({
  indexSections: async () => ({ added: 0, updated: 0, removed: 0 }),
}));
vi.mock('../src/search/db.js', () => ({
  openDb: () => ({ execute: async () => ({ rows: [{ n: 1 }] }) }),
  ensureSchema: async () => {},
  closeDb: async () => {},
}));

const roots: string[] = [];

async function project(mode: CmdContext['mode'] = 'mcp'): Promise<CmdContext> {
  const root = await mkdtemp(join(tmpdir(), 'codekg-search-fallback-'));
  roots.push(root);
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'demo', main: 'src/index.ts' }),
  );
  await writeFile(join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  await writeBootstrapPlan(await createBootstrapPlan(root));
  return {
    latDir: join(root, 'lat.md'),
    projectRoot: root,
    styler: plainStyler,
    mode,
  };
}

beforeEach(async () => {
  const configRoot = await mkdtemp(join(tmpdir(), 'codekg-config-'));
  roots.push(configRoot);
  vi.stubEnv('XDG_CONFIG_HOME', configRoot);
  vi.stubEnv('LAT_EMBEDDING_PROVIDER', 'local');
  semantic.searchSections.mockReset();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('auto-semantic search', () => {
  it('falls back to lexical results when semantic search throws', async () => {
    semantic.searchSections.mockRejectedValue(new Error('401 Unauthorized'));
    const ctx = await project();

    const result = await codeKgSearchCommand(ctx, 'entry points', {
      backend: 'auto-semantic',
    });

    expect(result.isError).toBeFalsy();
    expect(result.output).toContain(
      'Backend: local lexical (auto-semantic fallback; Semantic search failed: 401 Unauthorized)',
    );
    expect(result.output).toContain('lat.md/architecture#Architecture');
  });
});

describe('explicit semantic search', () => {
  it('returns an error result instead of throwing', async () => {
    semantic.searchSections.mockRejectedValue(new Error('fetch failed'));
    const ctx = await project();

    const result = await codeKgSearchCommand(ctx, 'entry points', {
      backend: 'semantic',
    });

    expect(result.isError).toBe(true);
    expect(result.output).toBe(
      'Backend: semantic\nSemantic search failed: fetch failed',
    );
  });

  it('points to Code-KG commands when no provider is configured', async () => {
    for (const name of [
      'LAT_EMBEDDING_PROVIDER',
      'LAT_LLM_KEY',
      'LAT_LLM_KEY_FILE',
      'LAT_LLM_KEY_HELPER',
    ]) {
      vi.stubEnv(name, undefined);
    }
    const ctx = await project('cli');

    const result = await codeKgSearchCommand(ctx, 'entry points', {
      backend: 'semantic',
    });

    expect(result.isError).toBe(true);
    expect(result.output).toContain('code-kg semantic enable-local');
    expect(result.output).not.toContain('lat init');
  });

  it('suggests Code-KG navigation commands with semantic results', async () => {
    const ctx = await project('cli');
    const [section] = flattenSections(await loadAllSections(ctx.latDir));
    semantic.searchSections.mockResolvedValue([{ id: section.id }]);

    const result = await codeKgSearchCommand(ctx, 'entry points', {
      backend: 'semantic',
    });

    expect(result.isError).toBeFalsy();
    expect(result.output).toContain('`code-kg section "section#id"`');
    expect(result.output).not.toMatch(/`lat (section|search)/);
  });
});
