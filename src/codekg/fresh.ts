import { open, stat, rm, readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { extractProjectGraph, writeGraphCache } from './graph.js';
import type { ProjectGraph } from './types.js';
import { recordGraphCacheHit } from './structural.js';
import {
  collectFreshInputs,
  readFreshCache,
  writeFreshCache,
} from './fresh-cache.js';

const active = new Map<string, Promise<ProjectGraph>>();

export async function freshGraph(
  root: string,
  options: { writeCache?: boolean } = {},
): Promise<ProjectGraph> {
  root = resolve(root);
  const writeCache = options.writeCache !== false;
  const key = JSON.stringify([root, writeCache]);
  const pending = active.get(key);
  if (pending) return pending;
  const operation = refresh(root, writeCache);
  active.set(key, operation);
  try {
    return await operation;
  } finally {
    active.delete(key);
  }
}

async function refresh(
  root: string,
  writeCache: boolean,
): Promise<ProjectGraph> {
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
    // Key collection failures refuse reuse and flow to a real refresh. A cache
    // miss must never turn an unavailable/escaping source into a clean graph.
    const inputs = await collectFreshInputs(root).catch(() => null);
    const cached = inputs ? await readFreshCache(root, inputs) : null;
    if (cached) {
      recordGraphCacheHit(root, Object.keys(inputs!.sourceHashes).length);
      if (writeCache) await writeGraphCache(root, cached);
      return cached;
    }
    const graph = await extractProjectGraph(root, undefined, { cache: true });
    if (inputs && !graph.analysis.parse_errors.length) {
      const after = await collectFreshInputs(root).catch(() => null);
      if (after?.key === inputs.key) {
        await writeFreshCache(root, inputs, graph);
      }
    }
    // Lifecycle checks consume the freshly computed graph directly; the full
    // diagnostic JSON is optional. All input and graph validation still runs.
    if (writeCache) await writeGraphCache(root, graph);
    return graph;
  } finally {
    await handle.close();
    await rm(lock, { force: true });
  }
}
