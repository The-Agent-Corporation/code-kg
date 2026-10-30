import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HOOK_INPUT_IDLE_MS,
  hookInputProblem,
  readHookInput,
} from '../src/codekg/stdin.js';

const roots: string[] = [];
const cliPath = join(
  import.meta.dirname,
  '..',
  'dist',
  'src',
  'codekg',
  'cli.js',
);

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('readHookInput', () => {
  it('returns a complete JSON payload without waiting for end of input', async () => {
    const stream = new PassThrough();
    const pending = readHookInput(stream, { idleMs: 60_000 });
    stream.write('{"tool_name":"Grep",');
    stream.write('"tool_input":{"pattern":"x"}}\n');

    await expect(pending).resolves.toBe(
      '{"tool_name":"Grep","tool_input":{"pattern":"x"}}\n',
    );
    expect(stream.destroyed).toBe(true);
  });

  it('gives up after the idle timeout when the pipe stays open', async () => {
    const stream = new PassThrough();
    const pending = readHookInput(stream, { idleMs: 50 });
    stream.write('{"partial":');

    await expect(pending).resolves.toBe('{"partial":');
  });

  it('returns undefined for an open pipe that never sends data', async () => {
    await expect(
      readHookInput(new PassThrough(), { firstByteMs: 50 }),
    ).resolves.toBeUndefined();
  });

  it('returns what arrived when the input ends', async () => {
    const stream = new PassThrough();
    const pending = readHookInput(stream, { idleMs: 60_000 });
    stream.end('not json');

    await expect(pending).resolves.toBe('not json');
  });

  it('waits longer for the first byte than between chunks', async () => {
    vi.useFakeTimers();
    try {
      const stream = new PassThrough();
      const pending = readHookInput(stream);
      await vi.advanceTimersByTimeAsync(HOOK_INPUT_IDLE_MS + 500);
      stream.write('{"tool_name":"Grep"}');

      await expect(pending).resolves.toBe('{"tool_name":"Grep"}');
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits for the closing brace even when a string holds one', async () => {
    const stream = new PassThrough();
    const pending = readHookInput(stream, { idleMs: 60_000 });
    stream.write('{"pattern":"}"');
    await new Promise((resolve) => setImmediate(resolve));
    expect(stream.destroyed).toBe(false);
    stream.write(',"x":[1]}');

    await expect(pending).resolves.toBe('{"pattern":"}","x":[1]}');
  });

  it('decodes a multibyte character split across chunks', async () => {
    const stream = new PassThrough();
    const pending = readHookInput(stream, { idleMs: 60_000 });
    const bytes = Buffer.from('{"prompt":"café"}');
    const split = bytes.indexOf(0xc3) + 1;
    stream.write(bytes.subarray(0, split));
    stream.write(bytes.subarray(split));

    await expect(pending).resolves.toBe('{"prompt":"café"}');
  });
});

function runWithOpenStdin(
  args: string[],
  cwd: string,
  payload?: string,
): Promise<{ code: number | null }> {
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd,
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  if (payload) child.stdin.write(payload);
  return new Promise((resolve, reject) => {
    const guard = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${args.join(' ')} did not exit with stdin open`));
    }, 10_000);
    child.on('exit', (code) => {
      clearTimeout(guard);
      resolve({ code });
    });
  });
}

describe('hook commands with a host that keeps stdin open', () => {
  it('hook-check exits after reading a complete payload', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codekg-stdin-'));
    roots.push(root);
    const result = await runWithOpenStdin(
      ['hook-check'],
      root,
      JSON.stringify({ tool_name: 'Grep', tool_input: { pattern: 'auth' } }),
    );

    expect(result.code).toBe(0);
  }, 15_000);

  it('agent-context exits when no payload ever arrives', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codekg-stdin-'));
    roots.push(root);
    const result = await runWithOpenStdin(['agent-context', 'stop'], root);

    expect(result.code).toBe(0);
  }, 15_000);

  it('says on stderr when the payload is truncated JSON', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codekg-stdin-'));
    roots.push(root);
    const child = spawn(process.execPath, [cliPath, 'hook-check'], {
      cwd: root,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.stdin.end('{"tool_name":"Grep",');
    const code = await new Promise((resolve) => child.on('close', resolve));

    expect(code).toBe(0);
    expect(stderr).toBe(
      'code-kg: the hook payload on stdin is not complete JSON; skipping this hook\n',
    );
  }, 15_000);
});

describe('hookInputProblem', () => {
  it.each([
    [undefined, 'no hook payload arrived on stdin; skipping this hook'],
    ['  \n', 'no hook payload arrived on stdin; skipping this hook'],
    [
      '{"tool_name":',
      'the hook payload on stdin is not complete JSON; skipping this hook',
    ],
    ['{"tool_name":"Grep"}', null],
    ['rg auth src', null],
  ])('%j -> %j', (input, problem) => {
    expect(hookInputProblem(input)).toBe(problem);
  });
});
