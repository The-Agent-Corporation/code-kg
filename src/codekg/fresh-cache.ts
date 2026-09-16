import { createHash } from 'node:crypto';
import { readFile, realpath, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { discoverProject } from './discovery.js';
import {
  GRAPH_EXTENSIONS,
  sourceHash,
  resetExtractionCache,
} from './structural.js';
import { readJson, writeJsonAtomic } from './cache.js';
import type { DiscoveryResult, ProjectGraph } from './types.js';

const VERSION = 1;
const DATA = '.code-kg/cache/fresh-graph-v1.json';
const META = '.code-kg/cache/fresh-graph-v1.meta.json';
const require = createRequire(import.meta.url);
const runtimeExtensions = new Set([
  '.js',
  '.cjs',
  '.mjs',
  '.ts',
  '.json',
  '.node',
  '.wasm',
  '.scm',
]);

async function runtimeFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...(await runtimeFiles(path)));
    else if (
      entry.isFile() &&
      runtimeExtensions.has(extname(path)) &&
      !path.endsWith('.d.ts')
    )
      result.push(path);
  }
  return result;
}
export async function fingerprintRuntimeFiles(
  paths: string[],
): Promise<string> {
  const hash = createHash('sha256');
  for (const path of [...new Set(paths)].sort()) {
    hash.update(JSON.stringify(path));
    hash.update(
      createHash('sha256')
        .update(await readFile(path))
        .digest(),
    );
  }
  return hash.digest('hex');
}
export async function implementationFingerprint(): Promise<string> {
  const src = dirname(dirname(fileURLToPath(import.meta.url)));
  const files = await runtimeFiles(src);
  // Include actual installed parser/discovery runtime bytes, not a manual
  // extractor version or a package version that can conceal local patches.
  const seen = new Set<string>();
  async function dependency(name: string, resolver = require): Promise<void> {
    let pkg: string;
    try {
      pkg = resolver.resolve(name + '/package.json');
    } catch {
      let path = dirname(resolver.resolve(name));
      while (true) {
        try {
          await readFile(join(path, 'package.json'));
          pkg = join(path, 'package.json');
          break;
        } catch {
          const next = dirname(path);
          if (next === path)
            throw new Error('Missing runtime package metadata: ' + name);
          path = next;
        }
      }
    }
    if (seen.has(pkg)) return;
    seen.add(pkg);
    files.push(...(await runtimeFiles(dirname(pkg))));
    const manifest = JSON.parse(await readFile(pkg, 'utf8'));
    for (const child of Object.keys(manifest.dependencies ?? {})) {
      if (child in (manifest.optionalDependencies ?? {})) continue;
      await dependency(child, createRequire(pkg));
    }
  }
  for (const name of [
    'tree-sitter',
    'tree-sitter-typescript',
    'tree-sitter-python',
    'tree-sitter-go',
    'tree-sitter-java',
    'tree-sitter-kotlin',
    'tree-sitter-swift',
    'tree-sitter-php',
    'tree-sitter-r',
    'web-tree-sitter',
    'tree-sitter-wasm',
    '@repomix/tree-sitter-wasms',
    'ignore-walk',
  ])
    await dependency(name);
  return fingerprintRuntimeFiles(files);
}
export type FreshInputs = {
  key: string;
  runtime: string;
  discovery: DiscoveryResult;
  sourceHashes: Record<string, string>;
};
export async function collectFreshInputs(root: string): Promise<FreshInputs> {
  const discovery = await discoverProject(root);
  const selected = discovery.files.filter(
    (f) =>
      (f.category === 'code' || f.category === 'test') &&
      GRAPH_EXTENSIONS.has(f.extension),
  );
  const realRoot = await realpath(root);
  const sourceHashes: Record<string, string> = {};
  const resolved: string[] = [];
  for (const file of selected) {
    const actual = await realpath(join(root, file.path));
    const local = relative(realRoot, actual);
    if (local === '..' || local.startsWith('../'))
      throw new Error('source symlink escapes the repository: ' + file.path);
    resolved.push(actual);
    sourceHashes[file.path] = sourceHash(
      await readFile(join(root, file.path), 'utf8'),
    );
  }
  const goPaths = new Set<string>();
  for (const file of selected.filter((f) => f.path.endsWith('.go'))) {
    let dir = dirname(file.path);
    for (;;) {
      goPaths.add(join(dir, 'go.mod'));
      if (dir === '.') break;
      dir = dirname(dir);
    }
  }
  const goInputs: [string, string | null][] = [];
  for (const path of [...goPaths].sort()) {
    try {
      goInputs.push([
        path,
        sourceHash(await readFile(join(root, path), 'utf8')),
      ]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      goInputs.push([path, null]);
    }
  }
  const runtime = await implementationFingerprint();
  const key = sourceHash(
    JSON.stringify({
      version: VERSION,
      runtime,
      node: process.version,
      root: realRoot,
      files: selected.map((f) => [f.path, f.category, f.extension]),
      resolved,
      sourceHashes,
      goInputs,
    }),
  );
  return { key, runtime, discovery, sourceHashes };
}
export async function readFreshCache(
  root: string,
  input: FreshInputs,
): Promise<ProjectGraph | null> {
  const meta = await readJson<{
    version: number;
    input: string;
    bytes: string;
  }>(join(root, META));
  if (meta?.version !== VERSION || meta.input !== input.key) return null;
  try {
    const bytes = await readFile(join(root, DATA), 'utf8');
    if (sourceHash(bytes) !== meta.bytes) return null;
    const graph = JSON.parse(bytes) as ProjectGraph;
    if (
      !Array.isArray(graph.nodes) ||
      !Array.isArray(graph.edges) ||
      !Array.isArray(graph.analysis?.parse_errors) ||
      graph.analysis.parse_errors.length ||
      JSON.stringify(graph.source_hashes) !== JSON.stringify(input.sourceHashes)
    )
      return null;
    return graph;
  } catch {
    return null;
  }
}
export async function writeFreshCache(
  root: string,
  input: FreshInputs,
  graph: ProjectGraph,
): Promise<void> {
  if (
    graph.analysis.parse_errors.length ||
    JSON.stringify(graph.source_hashes) !== JSON.stringify(input.sourceHashes)
  )
    return;
  await writeJsonAtomic(join(root, DATA), graph);
  const bytes = await readFile(join(root, DATA), 'utf8');
  await writeJsonAtomic(join(root, META), {
    version: VERSION,
    input: input.key,
    bytes: sourceHash(bytes),
  });
}

export async function qualifyExtractionRuntime(
  root: string,
  runtime: string,
): Promise<void> {
  const path = join(root, '.code-kg/cache/extraction-runtime.json');
  const prior = await readJson<{ runtime: string; bytes: string }>(path);
  const bytes = await readFile(
    join(root, '.code-kg/cache/extraction-v1.json'),
    'utf8',
  ).catch(() => null);
  if (
    prior?.runtime !== runtime ||
    bytes === null ||
    prior.bytes !== sourceHash(bytes)
  ) {
    await resetExtractionCache(root);
  }
}
export async function recordExtractionRuntime(
  root: string,
  runtime: string,
): Promise<void> {
  const bytes = await readFile(
    join(root, '.code-kg/cache/extraction-v1.json'),
    'utf8',
  );
  // Root-independent and generated from actual extraction bytes: portable to
  // identical worktrees, whose contents and containment are checked afresh.
  await writeJsonAtomic(join(root, '.code-kg/cache/extraction-runtime.json'), {
    runtime,
    bytes: sourceHash(bytes),
  });
}
