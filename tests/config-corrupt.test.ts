import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getConfigPath,
  hasEmbeddingConfig,
  readConfig,
} from '../src/config.js';
import { codeKgCheckCommand } from '../src/codekg/check.js';
import { codeKgSearchCommand } from '../src/codekg/search.js';
import { enrichCommand } from '../src/codekg/enrich.js';
import { semanticCommand } from '../src/codekg/semantic.js';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import { plainStyler, type CmdContext } from '../src/context.js';

const roots: string[] = [];
const CORRUPT = '{"embedding_provider": "local",';

beforeEach(async () => {
  const configRoot = await mkdtemp(join(tmpdir(), 'codekg-config-'));
  roots.push(configRoot);
  vi.stubEnv('XDG_CONFIG_HOME', configRoot);
  for (const name of [
    'LAT_LLM_KEY',
    'LAT_LLM_KEY_FILE',
    'LAT_LLM_KEY_HELPER',
    'LAT_EMBEDDING_PROVIDER',
  ]) {
    vi.stubEnv(name, undefined);
  }
  await mkdir(dirname(getConfigPath()), { recursive: true });
  await writeFile(getConfigPath(), CORRUPT);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function project(): Promise<CmdContext> {
  const root = await mkdtemp(join(tmpdir(), 'codekg-corrupt-config-'));
  roots.push(root);
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  await writeBootstrapPlan(await createBootstrapPlan(root));
  return {
    latDir: join(root, 'lat.md'),
    projectRoot: root,
    styler: plainStyler,
    mode: 'mcp',
  };
}

describe('a corrupt lat config file', () => {
  it('throws a descriptive error instead of exiting the process', () => {
    const exit = vi.spyOn(process, 'exit');
    try {
      expect(() => readConfig()).toThrow(
        /^Failed to parse config .*config\.json/,
      );
      expect(hasEmbeddingConfig()).toBe(false);
      expect(exit).not.toHaveBeenCalled();
    } finally {
      exit.mockRestore();
    }
  });

  it.each([
    ['{"llm_key": "sk-secret-123" x}', ' (line 1, column 29)'],
    ['x{"llm_key": "sk-secret-123"}', ''],
    ['{"llm_key": "sk-secret-123",\n}', ' (line 2, column 1)'],
  ])(
    'never echoes config contents in the parse error: %j',
    async (content, at) => {
      await writeFile(getConfigPath(), content);

      expect(() => readConfig()).toThrow(
        new Error(
          `Failed to parse config ${getConfigPath()}: not valid JSON${at}`,
        ),
      );
      for (const message of [
        (await codeKgCheckCommand(await project())).output,
        (await semanticCommand(await project(), { action: 'status' })).output,
      ]) {
        expect(message).not.toContain('sk-secret');
      }
    },
  );

  it('leaves auto-semantic search working on the lexical backend', async () => {
    const result = await codeKgSearchCommand(await project(), 'architecture', {
      backend: 'auto-semantic',
    });

    expect(result.isError).toBeFalsy();
    expect(result.output).toContain(
      'Backend: local lexical (auto-semantic fallback; Failed to parse config',
    );
  });

  it('names the unreadable config in the check warning', async () => {
    const result = await codeKgCheckCommand(await project());

    expect(result.output).toContain(
      'Could not read the semantic embedding configuration: Failed to parse config',
    );
    expect(result.output).not.toContain('No semantic embedding provider');
  });

  it('reports the problem from semantic and enrich commands', async () => {
    const ctx = await project();

    const status = await semanticCommand(ctx, { action: 'status' });
    const enable = await semanticCommand(ctx, { action: 'enable-local' });
    const enrich = await enrichCommand(ctx);

    expect(status.output).toContain(
      'provider: invalid (Failed to parse config',
    );
    expect(enable.isError).toBe(true);
    expect(enable.output).toContain('Fix or remove the config file');
    expect(await readFile(getConfigPath(), 'utf-8')).toBe(CORRUPT);
    expect(enrich.isError).toBe(true);
    expect(enrich.output).toContain('skipped: Failed to parse config');
  });
});
