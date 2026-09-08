import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import {
  parseSourceSymbols,
  SOURCE_EXTENSIONS,
  type SourceSymbol,
} from '../source-parser.js';
import type { ExtractResult } from '../vendor/graft/graph/extract.js';
import type { EdgeV1, NodeV1 } from '../vendor/graft/graph/types.js';
import { readJson, writeJsonAtomic } from './cache.js';

// These extensions include the upstream depth and generic tiers. Keep source
// discovery independent of loading native parsers.
export const GRAPH_EXTENSIONS = new Set([
  ...SOURCE_EXTENSIONS,
  '.mts',
  '.cts',
  '.mjs',
  '.cjs',
  '.pyi',
  '.java',
  '.kt',
  '.kts',
  '.swift',
  '.php',
  '.r',
  '.cpp',
  '.cc',
  '.cxx',
  '.hpp',
  '.hh',
  '.rb',
  '.cs',
  '.scala',
  '.sc',
  '.ex',
  '.exs',
  '.sol',
  '.ml',
  '.mli',
  '.zig',
  '.dart',
  '.clj',
  '.cljs',
  '.cljc',
  '.bb',
  '.nix',
  '.lua',
]);

type FileExtraction = {
  hash: string;
  legacy: SourceSymbol[];
  structural: ExtractResult;
};
// Bump when changing the adapter, legacy symbol parser, or vendored extraction.
const EXTRACTOR_VERSION = 'graft-0.17.0-codekg-1';
type ExtractionCache = {
  version: 1;
  extractor: string;
  files: Record<string, FileExtraction>;
};
export type StructuralSnapshot = {
  files: Map<string, FileExtraction>;
  contents: Map<string, string>;
  nodes: NodeV1[];
  edges: EdgeV1[];
  errors: string[];
};
const memory = new Map<string, ExtractionCache>();
const stats = new Map<string, { parsed: number; reused: number }>();

export function extractionStats(root: string) {
  return stats.get(root) ?? { parsed: 0, reused: 0 };
}

export function sourceHash(text: string): string {
  return 'sha256:' + createHash('sha256').update(text).digest('hex');
}

export async function extractStructural(
  root: string,
  paths: string[],
  persist: boolean,
): Promise<StructuralSnapshot> {
  const { extractFile, languageOf } =
    await import('../vendor/graft/graph/extract.js');
  const { extractGeneric, genericLangOf, warmGenericGrammars, isWarm } =
    await import('../vendor/graft/graph/generic.js');
  const { resolveEdges } = await import('../vendor/graft/graph/resolve.js');
  const cachePath = join(root, '.code-kg/cache/extraction-v1.json');
  const disk = persist ? await readJson<ExtractionCache>(cachePath) : null;
  const prior = memory.get(root) ?? disk;
  const old =
    prior?.version === 1 && prior.extractor === EXTRACTOR_VERSION
      ? prior.files
      : {};
  const files: Record<string, FileExtraction> = {};
  const contents = new Map<string, string>();
  const errors: string[] = [];
  let parsed = 0;
  let reused = 0;
  const realRoot = await realpath(root);
  await warmGenericGrammars(
    paths.flatMap((path) => {
      const language = genericLangOf(path);
      return !languageOf(path) && language ? [language.name] : [];
    }),
  );
  // Native parsers are shared synchronously. Await file reads outside extraction;
  // never share a tree across calls, and resolve edges afresh after every edit.
  for (const path of paths) {
    try {
      const actual = await realpath(join(root, path));
      const local = relative(realRoot, actual);
      if (local === '..' || local.startsWith('../'))
        throw new Error('source symlink escapes the repository');
      const content = await readFile(join(root, path), 'utf8');
      contents.set(path, content);
      const hash = sourceHash(content);
      const cached = old?.[path];
      if (
        cached?.hash === hash &&
        Array.isArray(cached.legacy) &&
        Array.isArray(cached.structural?.nodes) &&
        Array.isArray(cached.structural?.rawEdges)
      ) {
        files[path] = cached;
        reused++;
        continue;
      }
      const language = languageOf(path);
      const generic = genericLangOf(path);
      if (!language && generic && !isWarm(generic.name)) {
        throw new Error('grammar unavailable for ' + generic.name);
      }
      const structural = language
        ? extractFile(path, content, language)
        : extractGeneric(path, content, generic!.name);
      const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
      const legacy = SOURCE_EXTENSIONS.has(extension)
        ? await parseSourceSymbols(path, content)
        : [];
      files[path] = { hash, legacy, structural };
      parsed++;
    } catch (error) {
      errors.push(path + ': ' + (error as Error).message);
    }
  }
  const nodes = Object.values(files).flatMap((file) => file.structural.nodes);
  const rawEdges = Object.values(files).flatMap(
    (file) => file.structural.rawEdges,
  );
  const goModules: { module: string; dir: string }[] = [];
  for (const path of paths.filter((path) => path.endsWith('.go'))) {
    let dir = dirname(path);
    for (;;) {
      try {
        const text = await readFile(join(root, dir, 'go.mod'), 'utf8');
        const module = /^module\s+(\S+)/m.exec(text)?.[1];
        if (module && !goModules.some((entry) => entry.dir === dir))
          goModules.push({ module, dir });
        break;
      } catch {}
      if (dir === '.') break;
      dir = dirname(dir);
    }
  }
  const cache: ExtractionCache = {
    version: 1,
    extractor: EXTRACTOR_VERSION,
    files,
  };
  memory.set(root, cache);
  // Bound roots retained by a long-lived workspace MCP server.
  if (memory.size > 8) memory.delete(memory.keys().next().value!);
  stats.set(root, { parsed, reused });
  if (
    persist &&
    errors.length === 0 &&
    (!disk ||
      parsed ||
      Object.keys(disk.files ?? {}).length !== paths.length ||
      disk.extractor !== EXTRACTOR_VERSION)
  )
    await writeJsonAtomic(cachePath, cache);
  return {
    files: new Map(Object.entries(files)),
    contents,
    nodes,
    edges: resolveEdges(nodes, rawEdges, { goModules }),
    errors,
  };
}
