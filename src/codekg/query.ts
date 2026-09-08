import { readFile } from 'node:fs/promises';
import { join, posix, resolve, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CmdContext, CmdResult } from '../context.js';
import { flattenSections, loadAllSections } from '../lattice.js';
import { getEmbeddingKey } from '../config.js';
import { runSearch } from '../cli/search.js';
import { freshGraph } from './fresh.js';
import { readJson } from './cache.js';
import { sourceHash } from './structural.js';
import { currentMeanings } from './meaning.js';
import { visibleGraph } from './visibility.js';
import type {
  EntityNode,
  MaterializationManifest,
  ProjectGraph,
} from './types.js';

export type QueryOptions = {
  limit?: number;
  maxTokens?: number;
  in?: string;
  source?: boolean;
  semantic?: boolean;
};
export type QueryHit = {
  id: string;
  kind: 'knowledge' | 'source';
  path: string;
  title: string;
  score: number;
  text: string;
  startLine?: number;
  endLine?: number;
  status?: string;
  confidence?: string;
};
export type QueryResult = {
  query: string;
  hits: QueryHit[];
  warnings: string[];
  backend: string;
};
const STOP = new Set(
  'a an and are at be by can do does for from how i in is it of on or the this to what where which who with'.split(
    ' ',
  ),
);
export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP.has(token));
}
export function withinScope(path: string, scope?: string): boolean {
  if (!scope || scope === '.') return true;
  const clean = posix.normalize(scope.replace(/\\/g, '/')).replace(/\/$/, '');
  if (clean.startsWith('/') || clean === '..' || clean.startsWith('../')) {
    throw new Error('Scope must be a project-relative path.');
  }
  return path === clean || path.startsWith(clean + '/');
}
export function bounded(text: string, maxTokens = 3000): string {
  if (!Number.isInteger(maxTokens) || maxTokens < 64 || maxTokens > 32000)
    throw new Error('max_tokens must be an integer between 64 and 32000.');
  const max = maxTokens * 4;
  return text.length <= max
    ? text
    : text.slice(0, max - 32) + '\n[output truncated by budget]\n';
}
export async function currentSource(
  root: string,
  graph: ProjectGraph,
  node: EntityNode,
): Promise<string | null> {
  const path = node.source_file;
  if (!path || relative(root, resolve(root, path)).startsWith('..'))
    return null;
  const text = await readFile(join(root, path), 'utf8').catch(() => null);
  if (text === null || sourceHash(text) !== graph.source_hashes?.[path])
    return null;
  const start = node.source_span?.start_line ?? 1;
  const end = Math.min(node.source_span?.end_line ?? 40, start + 79);
  return text
    .split('\n')
    .slice(start - 1, end)
    .join('\n');
}

function graphRank(
  graph: ProjectGraph,
  seeds: Map<string, number>,
): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (edge.relation === 'contains' || edge.relation === 'tests') continue;
    for (const [a, b] of [
      [edge.source, edge.target],
      [edge.target, edge.source],
    ]) {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      adjacency.get(a)!.add(b);
    }
  }
  const sum = [...seeds.values()].reduce((a, b) => a + b, 0);
  if (!sum) return new Map();
  const restart = new Map([...seeds].map(([id, value]) => [id, value / sum]));
  let ranks = restart;
  for (let i = 0; i < 25; i++) {
    const next = new Map([...restart].map(([id, value]) => [id, value * 0.25]));
    let dangling = 0;
    for (const [id, value] of ranks) {
      const neighbors = adjacency.get(id);
      if (!neighbors?.size) {
        dangling += value * 0.75;
        continue;
      }
      for (const neighbor of neighbors)
        next.set(
          neighbor,
          (next.get(neighbor) ?? 0) + (value * 0.75) / neighbors.size,
        );
    }
    for (const [id, value] of restart)
      next.set(id, (next.get(id) ?? 0) + dangling * value);
    ranks = next;
  }
  const max = Math.max(...ranks.values(), 1e-12);
  return new Map([...ranks].map(([id, value]) => [id, value / max]));
}

export async function ask(
  root: string,
  query: string,
  opts: QueryOptions = {},
): Promise<QueryResult> {
  if (!query.trim()) throw new Error('Provide a search query.');
  withinScope('', opts.in);
  if (
    opts.limit !== undefined &&
    (!Number.isInteger(opts.limit) || opts.limit < 1 || opts.limit > 100)
  )
    throw new Error('Limit must be between 1 and 100.');
  const graph = await visibleGraph(root, await freshGraph(root));
  const meanings = await currentMeanings(root, graph);
  const manifest = await readJson<MaterializationManifest>(
    join(root, '.code-kg/materialization-manifest.json'),
  );
  const nodes = graph.nodes.filter(
    (n) =>
      n.kind !== 'module' &&
      n.source_file &&
      withinScope(n.source_file, opts.in),
  );
  const terms = [...new Set(tokenize(query))];
  const docs = nodes.map((node) => ({
    node,
    name: tokenize(node.label),
    path: tokenize(node.source_file ?? ''),
    body: tokenize(
      (node.signature ?? '') +
        ' ' +
        (node.search_text ?? '') +
        ' ' +
        (meanings.get(node.source_file ?? '')?.summary ?? ''),
    ),
  }));
  const frequencies = new Map<string, number>();
  for (const doc of docs)
    for (const term of new Set([...doc.name, ...doc.path, ...doc.body]))
      frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  const avg =
    docs.reduce((sum, doc) => sum + doc.body.length, 0) /
    Math.max(1, docs.length);
  const seeds = new Map<string, number>();
  for (const doc of docs) {
    const counts = new Map<string, number>();
    for (const word of doc.body) counts.set(word, (counts.get(word) ?? 0) + 1);
    let value = 0;
    for (const term of terms) {
      const idf = Math.log(
        1 + docs.length / (1 + (frequencies.get(term) ?? 0)),
      );
      const tf = counts.get(term) ?? 0;
      value +=
        idf *
        ((doc.name.includes(term) ? 3 : 0) +
          (doc.path.includes(term) ? 2 : 0) +
          (tf * 2.2) /
            (tf + 1.2 * (0.25 + (0.75 * doc.body.length) / Math.max(1, avg))));
    }
    if (value > 0) seeds.set(doc.node.id, value);
  }
  const eligible = new Set(nodes.map((n) => n.id));
  const ranks = graphRank(
    {
      ...graph,
      edges: graph.edges.filter(
        (e) => eligible.has(e.source) && eligible.has(e.target),
      ),
    },
    seeds,
  );
  const max = Math.max(...seeds.values(), 1e-12);
  const hits: QueryHit[] = [];
  for (const node of nodes) {
    const lexical = (seeds.get(node.id) ?? 0) / max;
    const connected = ranks.get(node.id) ?? 0;
    if (!lexical && connected < 0.12) continue;
    hits.push({
      id: node.id,
      kind: 'source',
      path: node.source_file!,
      title: node.label,
      score: lexical + 0.5 * connected,
      text: node.signature ?? '',
      startLine: node.source_span?.start_line,
      endLine: node.source_span?.end_line,
      confidence: node.confidence,
    });
  }
  const warnings = [...graph.analysis.parse_errors];
  const sections = flattenSections(
    await loadAllSections(join(root, 'lat.md')).catch(() => []),
  );
  const semantic = new Map<string, number>();
  if (opts.semantic !== false) {
    try {
      const key = getEmbeddingKey();
      if (key && sections.length) {
        const found = await runSearch(
          join(root, 'lat.md'),
          query,
          key,
          opts.limit ?? 8,
        );
        found.matches.forEach((match, i) =>
          semantic.set(match.section.id, 1 / (1 + i)),
        );
      }
    } catch (error) {
      warnings.push(
        'Semantic search unavailable; used lexical/graph retrieval: ' +
          (error as Error).message,
      );
    }
  }
  const knowledgeFiles = new Map<string, string>();
  for (const section of sections) {
    let body = knowledgeFiles.get(section.filePath);
    if (body === undefined) {
      body = await readFile(join(root, section.filePath), 'utf8');
      knowledgeFiles.set(section.filePath, body);
    }
    const text = body
      .split('\n')
      .slice(section.startLine - 1, section.endLine)
      .join('\n');
    const owner = Object.values(manifest?.sections ?? {}).find(
      (s) => s.file === section.filePath,
    );
    if (owner?.status === 'suppressed' || owner?.status === 'orphaned')
      continue;
    if (
      opts.in &&
      !withinScope(section.filePath, opts.in) &&
      !owner?.source_node_ids.some((id) => nodes.some((n) => n.id === id))
    )
      continue;
    const words = new Set(tokenize(section.heading + ' ' + text));
    const overlap =
      terms.filter((t) => words.has(t)).length / Math.max(1, terms.length);
    const value = overlap + (semantic.get(section.id) ?? 0);
    if (!value) continue;
    const baseline =
      owner?.source_hashes ?? manifest?.sections.architecture?.source_hashes;
    const stale = Object.entries(baseline ?? {}).some(
      ([p, h]) => graph.source_hashes?.[p] !== h,
    );
    hits.push({
      id: section.id,
      kind: 'knowledge',
      path: section.filePath,
      title: section.heading,
      score:
        value *
        (owner?.status === 'curated' || owner?.status === 'edited' ? 1.15 : 1),
      text,
      startLine: section.startLine,
      endLine: section.endLine,
      status: stale
        ? 'source changed; review required'
        : owner
          ? owner.status + (baseline ? '' : '; source baseline unavailable')
          : 'authored; source not tracked',
    });
  }
  hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  // Preserve a range of files before filling remaining slots with sibling symbols.
  const seen = new Set<string>();
  const leaders: QueryHit[] = [],
    siblings: QueryHit[] = [];
  for (const hit of hits) {
    const key = hit.kind + ':' + hit.path;
    if (seen.has(key)) siblings.push(hit);
    else {
      seen.add(key);
      leaders.push(hit);
    }
  }
  const selected = [...leaders, ...siblings].slice(0, opts.limit ?? 8);
  if (opts.source !== false)
    for (const hit of selected.filter((h) => h.kind === 'source')) {
      const node = nodes.find((n) => n.id === hit.id)!;
      const source = await currentSource(root, graph, node);
      const meaning = meanings.get(hit.path);
      hit.text =
        source === null
          ? 'Source changed during retrieval; run the query again.'
          : (meaning
              ? '[Inferred source description] ' + meaning.summary + '\n\n'
              : '') + source;
    }
  return {
    query,
    hits: selected,
    warnings,
    backend: semantic.size
      ? 'knowledge + semantic + lexical + graph'
      : 'knowledge + lexical + graph',
  };
}

export function formatQuery(
  result: QueryResult,
  opts: QueryOptions = {},
): string {
  const lines = ['# Code-KG Context', '', 'Backend: ' + result.backend];
  for (const warning of result.warnings) lines.push('Warning: ' + warning);
  for (const hit of result.hits) {
    lines.push(
      '',
      '## ' + hit.title,
      hit.kind + ': ' + hit.path + (hit.startLine ? ':' + hit.startLine : ''),
      hit.status ?? hit.confidence ?? '',
      opts.source === false && hit.kind === 'source' ? '' : hit.text,
    );
  }
  if (!result.hits.length)
    lines.push('', 'No matching knowledge or source found.');
  return bounded(lines.join('\n'), opts.maxTokens);
}
export async function askCommand(
  ctx: CmdContext,
  query: string,
  opts: QueryOptions = {},
): Promise<CmdResult> {
  return { output: formatQuery(await ask(ctx.projectRoot, query, opts), opts) };
}

export async function trace(
  root: string,
  query: string,
  opts: { direction?: 'in' | 'out'; depth?: number; in?: string } = {},
) {
  withinScope('', opts.in);
  const graph = await visibleGraph(root, await freshGraph(root));
  const visible = graph.nodes.filter(
    (n) => n.kind !== 'module' && withinScope(n.source_file ?? '', opts.in),
  );
  const byId = new Map(visible.map((n) => [n.id, n]));
  let seeds = visible.filter(
    (n) =>
      n.id === query ||
      n.label === query ||
      n.label.replace(/#/g, '.') === query ||
      n.source_file === query,
  );
  if (!seeds.length)
    seeds = visible.filter((n) => n.label.endsWith('#' + query));
  const ids = new Set(visible.map((n) => n.id));
  const visited = new Set(seeds.map((n) => n.id));
  let frontier = new Set(visited);
  const hits: {
    node: EntityNode;
    depth: number;
    relation: string;
    confidence: string;
  }[] = [];
  const depth = opts.depth ?? 1;
  if ((!Number.isInteger(depth) || depth < 1) && depth !== Infinity)
    throw new Error('Depth must be a positive integer or all.');
  const incoming = opts.direction !== 'out';
  for (let d = 1; frontier.size && d <= depth; d++) {
    const next = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.relation === 'contains') continue;
      const from = incoming ? edge.target : edge.source;
      const to = incoming ? edge.source : edge.target;
      if (!frontier.has(from) || visited.has(to) || !ids.has(to)) continue;
      const node = byId.get(to)!;
      visited.add(to);
      next.add(to);
      hits.push({
        node,
        depth: d,
        relation: edge.relation,
        confidence: edge.confidence,
      });
    }
    frontier = next;
  }
  return { query, seeds, hits, warnings: graph.analysis.parse_errors };
}
export async function traceCommand(
  ctx: CmdContext,
  query: string,
  opts: {
    direction?: 'in' | 'out';
    depth?: number;
    in?: string;
    maxTokens?: number;
  } = {},
): Promise<CmdResult> {
  const result = await trace(ctx.projectRoot, query, opts);
  return {
    output: bounded(
      [
        '# Code-KG ' + (opts.direction === 'out' ? 'Dependencies' : 'Impact'),
        '',
        'Query: ' + query,
        ...result.warnings.map((w) => 'Warning: ' + w),
        ...result.seeds.map(
          (n) => 'Seed: ' + n.label + ' (' + n.source_file + ')',
        ),
        ...result.hits.map(
          (h) =>
            '- ' +
            h.node.label +
            ' | ' +
            h.node.source_file +
            ':' +
            (h.node.source_span?.start_line ?? 1) +
            ' | ' +
            h.relation +
            ' | depth ' +
            h.depth +
            ' | ' +
            h.confidence,
        ),
        ...(result.seeds.length ? [] : ['No matching source symbol or file.']),
      ].join('\n'),
      opts.maxTokens,
    ),
  };
}

export async function mapCommand(
  ctx: CmdContext,
  opts: QueryOptions = {},
): Promise<CmdResult> {
  withinScope('', opts.in);
  const graph = await visibleGraph(
    ctx.projectRoot,
    await freshGraph(ctx.projectRoot),
  );
  const nodes = graph.nodes.filter(
    (n) =>
      n.kind !== 'module' &&
      n.source_file &&
      withinScope(n.source_file, opts.in),
  );
  const incoming = new Map<string, number>();
  for (const edge of graph.edges)
    if (edge.relation !== 'contains')
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  const files = nodes.filter((n) => n.kind === 'file');
  const hotspots = nodes
    .filter((n) => incoming.has(n.id))
    .sort((a, b) => incoming.get(b.id)! - incoming.get(a.id)!);
  const groups = new Map<string, number>();
  for (const file of files) {
    const dir = posix.dirname(file.source_file!);
    groups.set(dir, (groups.get(dir) ?? 0) + 1);
  }
  return {
    output: bounded(
      [
        '# Code-KG Repository Map',
        '',
        files.length + ' files; ' + (nodes.length - files.length) + ' symbols',
        ...[...groups]
          .sort((a, b) => b[1] - a[1])
          .map(([dir, count]) => '- ' + dir + ': ' + count + ' files'),
        '',
        '## Dependency Hotspots',
        ...hotspots
          .slice(0, opts.limit ?? 12)
          .map(
            (n) =>
              '- ' +
              n.label +
              ' (' +
              incoming.get(n.id) +
              ' incoming): ' +
              n.source_file,
          ),
        ...graph.analysis.parse_errors.map((e) => 'Warning: ' + e),
      ].join('\n'),
      opts.maxTokens,
    ),
  };
}

export async function skeletonCommand(
  ctx: CmdContext,
  path: string,
  opts: QueryOptions = {},
): Promise<CmdResult> {
  const graph = await visibleGraph(
    ctx.projectRoot,
    await freshGraph(ctx.projectRoot),
  );
  const files = [
    ...new Set(
      graph.nodes.flatMap((n) => (n.source_file ? [n.source_file] : [])),
    ),
  ];
  const matches = files.includes(path)
    ? [path]
    : files.filter((f) => posix.basename(f) === path);
  if (matches.length !== 1)
    return {
      output: matches.length
        ? 'Ambiguous file: ' + matches.join(', ')
        : 'No indexed file: ' + path,
      isError: true,
    };
  return {
    output: bounded(
      [
        '# ' + matches[0],
        ...graph.nodes
          .filter((n) => n.source_file === matches[0] && n.kind !== 'file')
          .sort(
            (a, b) =>
              (a.source_span?.start_line ?? 0) -
              (b.source_span?.start_line ?? 0),
          )
          .map(
            (n) =>
              '- ' +
              (n.source_span?.start_line ?? 1) +
              ': ' +
              (n.signature ?? n.label),
          ),
      ].join('\n'),
      opts.maxTokens,
    ),
  };
}

export async function grepCommand(
  ctx: CmdContext,
  pattern: string,
  opts: QueryOptions & { regex?: boolean; ignoreCase?: boolean } = {},
): Promise<CmdResult> {
  if (!pattern) throw new Error('Provide a search pattern.');
  withinScope('', opts.in);
  const graph = await visibleGraph(
    ctx.projectRoot,
    await freshGraph(ctx.projectRoot),
  );
  const files = [
    ...new Set(
      graph.nodes
        .filter(
          (n) =>
            n.kind === 'file' &&
            n.source_file &&
            withinScope(n.source_file, opts.in),
        )
        .map((n) => n.source_file!),
    ),
  ];
  const lines = ['# Code-KG Find All', ''];
  let count = 0;
  if (opts.regex) {
    // ripgrep uses a bounded regex engine and handles source encodings itself.
    for (let i = 0; i < files.length; i += 100) {
      const args = [
        '--json',
        '--no-ignore',
        ...(opts.ignoreCase ? ['-i'] : []),
        '--',
        pattern,
        ...files.slice(i, i + 100),
      ];
      try {
        const { stdout } = await promisify(execFile)('rg', args, {
          cwd: ctx.projectRoot,
          maxBuffer: 8 * 1024 * 1024,
          timeout: 10000,
        });
        for (const line of stdout.trim().split('\n')) {
          const row = JSON.parse(line);
          if (row.type === 'match') {
            count++;
            lines.push(
              row.data.path.text +
                ':' +
                row.data.line_number +
                ': ' +
                row.data.lines.text.trimEnd(),
            );
          }
        }
      } catch (error) {
        if ((error as any).code !== 1)
          throw new Error(
            'Regex search requires ripgrep: ' + (error as Error).message,
          );
      }
    }
  } else
    for (const file of files) {
      const text = await readFile(join(ctx.projectRoot, file), 'utf8');
      text.split('\n').forEach((line, i) => {
        if (
          (opts.ignoreCase ? line.toLowerCase() : line).includes(
            opts.ignoreCase ? pattern.toLowerCase() : pattern,
          )
        ) {
          count++;
          const symbol = graph.nodes
            .filter(
              (n) =>
                n.source_file === file &&
                n.source_span &&
                n.source_span.start_line <= i + 1 &&
                n.source_span.end_line >= i + 1,
            )
            .sort(
              (a, b) =>
                a.source_span!.end_line -
                a.source_span!.start_line -
                (b.source_span!.end_line - b.source_span!.start_line),
            )[0];
          lines.push(
            file +
              ':' +
              (i + 1) +
              (symbol ? ' [' + symbol.label + ']' : '') +
              ': ' +
              line,
          );
        }
      });
    }
  lines.splice(2, 0, count + ' matches in ' + files.length + ' indexed files.');
  return { output: bounded(lines.join('\n'), opts.maxTokens) };
}
