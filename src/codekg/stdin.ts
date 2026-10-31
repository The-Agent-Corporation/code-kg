import type { Readable } from 'node:stream';

export const HOOK_INPUT_IDLE_MS = 1500;
/** Hosts can be slow to start writing; hook timeouts are 10-15s. */
export const HOOK_INPUT_FIRST_BYTE_MS = 5000;

export type HookInputOptions = {
  /** How long to wait for more data once some has arrived. */
  idleMs?: number;
  /** How long to wait for the first data. */
  firstByteMs?: number;
};

/**
 * Tracks bracket depth outside JSON strings across chunks, so the payload is
 * parsed only when a top-level value may have closed.
 */
function topLevelCloseTracker(): (chunk: string) => boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;
  return (chunk) => {
    let closed = false;
    for (const char of chunk) {
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
      } else if (char === '"') inString = true;
      else if (char === '{' || char === '[') depth++;
      else if ((char === '}' || char === ']') && depth > 0 && --depth === 0)
        closed = true;
    }
    return closed;
  };
}

function isCompleteJson(input: string): boolean {
  try {
    JSON.parse(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads a hook payload without depending on the host closing the pipe.
 * Resolves at end of input, as soon as the input is one complete JSON value,
 * or when no data arrives in time. The stream is destroyed afterwards so an
 * open pipe cannot keep the process alive.
 */
export function readHookInput(
  stream: Readable & { isTTY?: boolean },
  {
    idleMs = HOOK_INPUT_IDLE_MS,
    firstByteMs = HOOK_INPUT_FIRST_BYTE_MS,
  }: HookInputOptions = {},
): Promise<string | undefined> {
  if (stream.isTTY) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    let input = '';
    let timer: NodeJS.Timeout | undefined;
    const closes = topLevelCloseTracker();
    const finish = () => {
      clearTimeout(timer);
      stream.off('data', onData);
      stream.off('end', finish);
      stream.off('error', finish);
      stream.destroy();
      resolve(input || undefined);
    };
    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(finish, ms);
    };
    const onData = (chunk: string) => {
      input += chunk;
      if (closes(chunk) && isCompleteJson(input)) finish();
      else arm(idleMs);
    };
    // Decodes multibyte characters split across chunks.
    stream.setEncoding('utf8');
    stream.on('data', onData);
    stream.once('end', finish);
    stream.once('error', finish);
    arm(firstByteMs);
  });
}

/** Why a hook will ignore its stdin payload, or null when it looks usable. */
export function hookInputProblem(input: string | undefined): string | null {
  const trimmed = input?.trim();
  if (!trimmed) return 'no hook payload arrived on stdin; skipping this hook';
  if (/^[{[]/.test(trimmed) && !isCompleteJson(trimmed))
    return 'the hook payload on stdin is not complete JSON; skipping this hook';
  return null;
}
