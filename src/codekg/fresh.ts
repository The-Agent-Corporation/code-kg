import { open, stat, rm, readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { extractProjectGraph, writeGraphCache } from './graph.js';
import type { ProjectGraph } from './types.js';

const active = new Map<string, Promise<ProjectGraph>>();

export async function freshGraph(root: string): Promise<ProjectGraph> {
  root = resolve(root);
  const pending = active.get(root);
  if (pending) return pending;
  const operation = refresh(root);
  active.set(root, operation);
  try {
    return await operation;
  } finally {
    active.delete(root);
  }
}

async function refresh(root: string): Promise<ProjectGraph> {
  const directory = join(root, '.code-kg/cache');
  await mkdir(directory, { recursive: true });
  const lock = join(directory, 'refresh.lock');
  const deadline = Date.now() + 10000;
  let handle;
  while (!handle) {
    try {
      handle = await open(lock, 'wx');
      await handle.writeFile(String(process.pid));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const info = await stat(lock).catch(() => null);
      const owner = Number(await readFile(lock, 'utf8').catch(() => ''));
      let dead = false;
      if (owner > 0) {
        try {
          process.kill(owner, 0);
        } catch (e) {
          dead = (e as NodeJS.ErrnoException).code === 'ESRCH';
        }
      }
      if (dead || (!owner && info && Date.now() - info.mtimeMs > 300000)) {
        await rm(lock, { force: true });
        continue;
      }
      if (Date.now() >= deadline)
        throw new Error('Code-KG refresh is busy; retry the query.');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  try {
    const graph = await extractProjectGraph(root, undefined, { cache: true });
    await writeGraphCache(root, graph);
    return graph;
  } finally {
    await handle.close();
    await rm(lock, { force: true });
  }
}
