import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  readFile,
  readdir,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { plainStyler } from '../src/context.js';
vi.mock('../src/codekg/fresh.js', () => ({
  freshGraph: vi.fn(async () => {
    throw new Error('synthetic refresh lock failure');
  }),
}));
vi.mock('../src/codekg/check.js', () => ({
  codeKgCheckCommand: vi.fn(async () => ({ output: 'All checks passed' })),
}));
vi.mock('../src/codekg/work.js', () => ({
  workSessionSummary: vi.fn(async () => null),
}));
import { freshGraph } from '../src/codekg/fresh.js';
import * as cache from '../src/codekg/cache.js';
import { workSessionSummary } from '../src/codekg/work.js';
import { agentContextCommand } from '../src/codekg/agent-context.js';
const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
describe('Stop structural freshness failure', () => {
  it.each(['worker', 'orchestrator', 'full'])(
    'blocks once and warns honestly on second pass for %s',
    async (role) => {
      vi.stubEnv('CODEKG_AGENT_ROLE', role);
      const root = await mkdtemp(join(tmpdir(), 'codekg-stop-refresh-'));
      roots.push(root);
      await mkdir(join(root, '.code-kg'));
      await writeFile(
        join(root, '.code-kg/materialization-manifest.json'),
        '{}',
      );
      const ctx = {
        projectRoot: root,
        latDir: join(root, 'lat.md'),
        styler: plainStyler,
        mode: 'cli' as const,
      };
      const first = JSON.parse(
        (await agentContextCommand(ctx, 'stop', '{}')).output,
      );
      expect(first.decision).toBe('block');
      expect(freshGraph).toHaveBeenCalledWith(root, { writeCache: false });
      expect(first.reason).toContain('freshness is unverified');
      expect(first.reason).toContain('synthetic refresh lock failure');
      vi.mocked(freshGraph).mockResolvedValueOnce({
        analysis: { parse_errors: ['synthetic unavailable source'] },
      } as unknown as Awaited<ReturnType<typeof freshGraph>>);
      const extractionFailure = JSON.parse(
        (await agentContextCommand(ctx, 'stop', '{}')).output,
      );
      expect(extractionFailure.decision).toBe('block');
      expect(extractionFailure.reason).toContain(
        'synthetic unavailable source',
      );
      const second = await agentContextCommand(
        ctx,
        'stop',
        '{"stop_hook_active":true}',
      );
      expect(second.output).toBe('');
      const receipts = await readdir(join(root, '.code-kg/cache'));
      const receipt = JSON.parse(
        await readFile(
          join(
            root,
            '.code-kg/cache',
            receipts.find((f) => f.startsWith('stop-status-'))!,
          ),
          'utf8',
        ),
      );
      expect(receipt.unresolved).toBe(true);
      expect(receipt.reason).toContain('freshness is unverified');
      expect(receipt.stopHookActive).toBe(true);
      const cursor = JSON.parse(
        (await agentContextCommand(ctx, 'stop', '{"agent":"cursor"}')).output,
      );
      expect(cursor.followup_message).toContain('freshness is unverified');
    },
  );
});

it('does not repeat soft open-work feedback after Claude acknowledges Stop', async () => {
  vi.stubEnv('CODEKG_AGENT_ROLE', 'worker');
  const root = await mkdtemp(join(tmpdir(), 'codekg-stop-soft-'));
  roots.push(root);
  await mkdir(join(root, '.code-kg'));
  await writeFile(join(root, '.code-kg/materialization-manifest.json'), '{}');
  const ctx = {
    projectRoot: root,
    latDir: join(root, 'lat.md'),
    styler: plainStyler,
    mode: 'cli' as const,
  };
  vi.mocked(freshGraph).mockResolvedValue({
    analysis: { parse_errors: [] },
  } as unknown as Awaited<ReturnType<typeof freshGraph>>);
  vi.mocked(workSessionSummary).mockResolvedValue('ready ck-1234: setup only');
  const first = JSON.parse(
    (await agentContextCommand(ctx, 'stop', '{}')).output,
  );
  expect(first.hookSpecificOutput.additionalContext).toContain(
    'Open work remains',
  );
  expect(first.decision).toBeUndefined();
  expect(
    (await agentContextCommand(ctx, 'stop', '{"stop_hook_active":true}'))
      .output,
  ).toBe('');
});

it('a failed diagnostic write cannot suppress an unresolved Stop block', async () => {
  vi.stubEnv('CODEKG_AGENT_ROLE', 'worker');
  const root = await mkdtemp(join(tmpdir(), 'codekg-stop-disk-'));
  roots.push(root);
  await mkdir(join(root, '.code-kg'));
  await writeFile(join(root, '.code-kg/materialization-manifest.json'), '{}');
  vi.mocked(freshGraph).mockRejectedValueOnce(new Error('refresh unavailable'));
  const write = vi
    .spyOn(cache, 'writeJsonAtomic')
    .mockRejectedValueOnce(new Error('disk unavailable'));
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  try {
    const result = JSON.parse(
      (
        await agentContextCommand(
          {
            projectRoot: root,
            latDir: join(root, 'lat.md'),
            styler: plainStyler,
            mode: 'cli',
          },
          'stop',
          '{}',
        )
      ).output,
    );
    expect(result.decision).toBe('block');
    expect(result.reason).toContain('refresh unavailable');
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining('could not persist unresolved Stop evidence'),
    );
  } finally {
    write.mockRestore();
    stderr.mockRestore();
  }
});
