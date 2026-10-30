import type { Readable } from 'node:stream';

export const HOOK_INPUT_IDLE_MS = 1500;

function isCompleteJson(input: string): boolean {
  const trimmed = input.trimEnd();
  if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads a hook payload without depending on the host closing the pipe.
 * Resolves at end of input, as soon as the input is one complete JSON value,
 * or after `idleMs` without new data. The stream is destroyed afterwards so
 * an open pipe cannot keep the process alive.
 */
export function readHookInput(
  stream: Readable & { isTTY?: boolean },
  idleMs = HOOK_INPUT_IDLE_MS,
): Promise<string | undefined> {
  if (stream.isTTY) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    let input = '';
    let timer: NodeJS.Timeout | undefined;
    const finish = () => {
      clearTimeout(timer);
      stream.off('data', onData);
      stream.off('end', finish);
      stream.off('error', finish);
      stream.destroy();
      resolve(input || undefined);
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(finish, idleMs);
    };
    const onData = (chunk: Buffer | string) => {
      input += String(chunk);
      if (isCompleteJson(input)) finish();
      else arm();
    };
    stream.on('data', onData);
    stream.once('end', finish);
    stream.once('error', finish);
    arm();
  });
}
