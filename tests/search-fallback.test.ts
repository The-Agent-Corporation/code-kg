import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import { codeKgSearchCommand } from '../src/codekg/search.js';
import { plainStyler, type CmdContext } from '../src/context.js';

const semantic = vi.hoisted(() => ({
  searchCommand: vi.fn(),
}));

vi.mock('../src/cli/search.js', () => ({
  searchCommand: semantic.searchCommand,
  cliProgress: () => undefined,
}));

const roots: string[] = [];

async function project(): Promise<CmdContext> {
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
    mode: 'mcp',
  };
}

beforeEach(async () => {
  const configRoot = await mkdtemp(join(tmpdir(), 'codekg-config-'));
  roots.push(configRoot);
  vi.stubEnv('XDG_CONFIG_HOME', configRoot);
  vi.stubEnv('LAT_EMBEDDING_PROVIDER', 'local');
  semantic.searchCommand.mockReset();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('auto-semantic search', () => {
  it('falls back to lexical results when semantic search throws', async () => {
    semantic.searchCommand.mockRejectedValue(new Error('401 Unauthorized'));
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

  it('falls back when semantic search reports an error result', async () => {
    semantic.searchCommand.mockResolvedValue({
      output: 'LAT_LLM_KEY_FILE (/missing) is empty.',
      isError: true,
    });
    const ctx = await project();

    const result = await codeKgSearchCommand(ctx, 'entry points', {
      backend: 'auto-semantic',
    });

    expect(result.isError).toBeFalsy();
    expect(result.output).toContain('auto-semantic fallback; LAT_LLM_KEY_FILE');
  });
});

describe('explicit semantic search', () => {
  it('returns an error result instead of throwing', async () => {
    semantic.searchCommand.mockRejectedValue(new Error('fetch failed'));
    const ctx = await project();

    const result = await codeKgSearchCommand(ctx, 'entry points', {
      backend: 'semantic',
    });

    expect(result.isError).toBe(true);
    expect(result.output).toBe(
      'Backend: semantic\nSemantic search failed: fetch failed',
    );
  });
});
