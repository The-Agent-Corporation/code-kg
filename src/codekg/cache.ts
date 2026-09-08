import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

export async function writeJsonAtomic(
  path: string,
  value: unknown,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = path + '.' + process.pid + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, JSON.stringify(value) + '\n', 'utf8');
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
