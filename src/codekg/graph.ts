import { createHash } from 'node:crypto';
import { dirname, extname, join, posix, resolve } from 'node:path';
import type { SourceSymbol } from '../source-parser.js';
import { discoverProject } from './discovery.js';
import {
  extractStructural,
  GRAPH_EXTENSIONS,
  sourceHash,
} from './structural.js';
import { writeJsonAtomic } from './cache.js';
import {
  closingParen,
  scanSource,
  stringAt,
  type SourceScan,
} from './source-scan.js';
import type {
  Community,
  DiscoveryResult,
  EntityNode,
  Gap,
  GraphFragment,
  ProjectGraph,
  RelationshipEdge,
} from './types.js';

const LOCAL_IMPORT_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.py',
  '.go',
  '.rs',
  '.c',
  '.h',
];

const GRAPH_CACHE_PATH = '.code-kg/cache/graph.json';

type ImportSpec = {
  primarySpecs: string[];
  fallbackSpecs: string[];
  line: number;
};

function stableId(prefix: string, ...parts: string[]): string {
  const raw = parts.join('|');
  const readable = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  const digest = createHash('sha1').update(raw).digest('hex').slice(0, 8);
  return `${prefix}_${readable || 'root'}_${digest}`;
}

function moduleLabel(path: string): string {
  const dir = dirname(path);
  if (dir === '.') return 'root';
  return dir.split('/')[0];
}

function fileNode(path: string): EntityNode {
  return {
    id: stableId('file', path),
    label: path,
    kind: 'file',
    source_file: path,
    confidence: 'EXTRACTED',
  };
}

function moduleNode(label: string): EntityNode {
  return {
    id: stableId('module', label),
    label,
    kind: 'module',
    confidence: 'EXTRACTED',
  };
}

function symbolNode(path: string, symbol: SourceSymbol): EntityNode {
  const label = symbol.parent ? `${symbol.parent}#${symbol.name}` : symbol.name;
  return {
    id: stableId('symbol', path, label, symbol.kind),
    label,
    kind: symbol.kind,
    source_file: path,
    source_span: {
      file: path,
      start_line: symbol.startLine,
      end_line: symbol.endLine,
    },
    confidence: 'EXTRACTED',
  };
}

function edge(
  source: string,
  target: string,
  relation: RelationshipEdge['relation'],
  sourceFile?: string,
  line?: number,
): RelationshipEdge {
  return {
    id: stableId('edge', source, relation, target),
    source,
    target,
    relation,
    level: 'structural',
    confidence: 'EXTRACTED',
    confidence_score: 1.0,
    source_file: sourceFile,
    source_span:
      sourceFile && line
        ? { file: sourceFile, start_line: line, end_line: line }
        : undefined,
  };
}

function validateGraphFragment(fragment: GraphFragment): void {
  const nodeIds = new Set(fragment.nodes.map((node) => node.id));
  for (const relationship of fragment.edges) {
    if (!nodeIds.has(relationship.source)) {
      throw new Error(`edge ${relationship.id} has missing source`);
    }
    if (!nodeIds.has(relationship.target)) {
      throw new Error(`edge ${relationship.id} has missing target`);
    }
  }
}

function extractImportSpecs(path: string, content: string): ImportSpec[] {
  const ext = extname(path);
  if (ext === '.py') return extractPythonImportSpecs(content);

  const specs: ImportSpec[] = [];
  const patterns = [
    /\bimport\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]*\s+from\s+['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const spec = match[1];
      if (!spec) continue;
      const line = content.slice(0, match.index).split('\n').length;
      specs.push({ primarySpecs: [spec], fallbackSpecs: [], line });
    }
  }

  return specs;
}

function extractPythonImportSpecs(content: string): ImportSpec[] {
  const specs: ImportSpec[] = [];
  const fromPattern = /^\s*from\s+([.\w]+)\s+import\s+([^\n#]+)/gm;
  const importPattern = /^\s*import\s+([^\n#]+)/gm;

  for (const match of content.matchAll(fromPattern)) {
    const moduleSpec = match[1];
    if (!moduleSpec) continue;
    const line = content.slice(0, match.index).split('\n').length;
    const importedNames = pythonImportedNames(match[2] ?? '');
    specs.push({
      primarySpecs: importedNames.map((name) =>
        joinPythonModule(moduleSpec, name),
      ),
      fallbackSpecs: [moduleSpec],
      line,
    });
  }

  for (const match of content.matchAll(importPattern)) {
    const line = content.slice(0, match.index).split('\n').length;
    for (const imported of pythonImportedNames(match[1] ?? '')) {
      specs.push({ primarySpecs: [imported], fallbackSpecs: [], line });
    }
  }

  return specs;
}

function pythonImportedNames(raw: string): string[] {
  return raw
    .replace(/[()]/g, ' ')
    .split(',')
    .map(
      (part) =>
        part
          .trim()
          .split(/\s+as\s+/i)[0]
          ?.trim() ?? '',
    )
    .filter((part) => /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(part));
}

function joinPythonModule(moduleSpec: string, importedName: string): string {
  if (/^\.+$/.test(moduleSpec)) return `${moduleSpec}${importedName}`;
  return `${moduleSpec}.${importedName}`;
}

function candidatePaths(base: string): string[] {
  if (/\.[cm]?jsx?$/.test(base)) {
    const stem = base.replace(/\.[cm]?jsx?$/, '');
    return [base, stem + '.ts', stem + '.tsx', stem + '.mts', stem + '.cts'];
  }
  if (extname(base)) return [base];
  return [
    ...LOCAL_IMPORT_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...LOCAL_IMPORT_EXTENSIONS.map((ext) => `${base}/index${ext}`),
    `${base}/__init__.py`,
  ];
}

function resolveLocalImportSpec(
  importer: string,
  spec: string,
  knownPaths: Set<string>,
): string | null {
  let base: string | null = null;
  if (spec.startsWith('.')) {
    if (extname(importer) === '.py') {
      const dots = spec.match(/^\.+/)?.[0].length ?? 0;
      const rest = spec.slice(dots).replace(/\./g, '/');
      let dir = dirname(importer);
      for (let i = 1; i < dots; i++) {
        dir = dirname(dir);
      }
      base = posix.normalize(posix.join(dir === '.' ? '' : dir, rest));
    } else {
      base = posix.normalize(posix.join(dirname(importer), spec));
    }
  } else if (
    extname(importer) === '.py' &&
    /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(spec)
  ) {
    base = spec.replace(/\./g, '/');
  }
  if (!base) return null;

  for (const candidate of candidatePaths(base)) {
    if (knownPaths.has(candidate)) return candidate;
  }
  return null;
}

function resolveLocalImports(
  importer: string,
  spec: ImportSpec,
  knownPaths: Set<string>,
): string[] {
  const primaryTargets = uniqueStrings(
    spec.primarySpecs
      .map((entry) => resolveLocalImportSpec(importer, entry, knownPaths))
      .filter((target): target is string => !!target),
  );
  if (primaryTargets.length > 0) return primaryTargets;
  return uniqueStrings(
    spec.fallbackSpecs
      .map((entry) => resolveLocalImportSpec(importer, entry, knownPaths))
      .filter((target): target is string => !!target),
  );
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items)].sort();
}

function mergeFragments(fragments: GraphFragment[]): GraphFragment {
  const nodes = new Map<string, EntityNode>();
  const edges = new Map<string, RelationshipEdge>();
  const parseErrors: string[] = [];
  for (const fragment of fragments) {
    for (const node of fragment.nodes) nodes.set(node.id, node);
    for (const relationship of fragment.edges) {
      edges.set(relationship.id, relationship);
    }
    parseErrors.push(...fragment.parse_errors);
  }
  return {
    nodes: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
    parse_errors: parseErrors.sort(),
  };
}

function nodeCommunity(node: EntityNode): string {
  if (node.kind === 'module') return node.label;
  if (node.source_file) return moduleLabel(node.source_file);
  return 'root';
}

function analyzeGraph(fragment: GraphFragment): ProjectGraph {
  const nodeById = new Map(fragment.nodes.map((node) => [node.id, node]));
  const degree = new Map<string, number>();
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const relationship of fragment.edges) {
    degree.set(relationship.source, (degree.get(relationship.source) ?? 0) + 1);
    degree.set(relationship.target, (degree.get(relationship.target) ?? 0) + 1);
    outgoing.set(
      relationship.source,
      (outgoing.get(relationship.source) ?? 0) + 1,
    );
    incoming.set(
      relationship.target,
      (incoming.get(relationship.target) ?? 0) + 1,
    );
  }

  const grouped = new Map<string, EntityNode[]>();
  for (const node of fragment.nodes) {
    const key = nodeCommunity(node);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(node);
  }

  const communities: Community[] = [...grouped.entries()]
    .map(([label, nodes]) => {
      const ids = new Set(nodes.map((node) => node.id));
      const incident = fragment.edges.filter(
        (relationship) =>
          ids.has(relationship.source) || ids.has(relationship.target),
      );
      const internal = incident.filter(
        (relationship) =>
          ids.has(relationship.source) && ids.has(relationship.target),
      );
      return {
        id: stableId('community', label),
        label,
        node_ids: [...ids].sort(),
        file_count: nodes.filter((node) => node.kind === 'file').length,
        symbol_count: nodes.filter(
          (node) => node.kind !== 'file' && node.kind !== 'module',
        ).length,
        cohesion:
          incident.length === 0
            ? 1
            : Number((internal.length / incident.length).toFixed(2)),
      };
    })
    .sort((a, b) => b.node_ids.length - a.node_ids.length);

  const godNodes = fragment.nodes
    .filter((node) => (degree.get(node.id) ?? 0) >= 3)
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, 10);

  const bridges = fragment.nodes
    .filter(
      (node) =>
        (incoming.get(node.id) ?? 0) > 0 && (outgoing.get(node.id) ?? 0) > 0,
    )
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, 10);

  const surprisingConnections = fragment.edges
    .filter((relationship) => relationship.relation === 'imports')
    .filter((relationship) => {
      const source = nodeById.get(relationship.source);
      const target = nodeById.get(relationship.target);
      return (
        source && target && nodeCommunity(source) !== nodeCommunity(target)
      );
    })
    .slice(0, 20);

  const filesWithSymbols = new Set(
    fragment.nodes
      .filter((node) => node.kind !== 'file' && node.kind !== 'module')
      .map((node) => node.source_file)
      .filter((file): file is string => !!file),
  );
  const gaps: Gap[] = fragment.nodes
    .filter((node) => node.kind === 'file')
    .filter(
      (node) => node.source_file && !filesWithSymbols.has(node.source_file),
    )
    .map((node) => ({
      kind: 'unparsed-file',
      node_id: node.id,
      file: node.source_file,
      message: `${node.source_file} has no extracted top-level symbols.`,
    }));

  return {
    nodes: fragment.nodes,
    edges: fragment.edges,
    communities,
    analysis: {
      god_nodes: godNodes,
      bridges,
      surprising_connections: surprisingConnections,
      gaps,
      algorithm: 'multi-language-directory-fallback',
      parse_errors: fragment.parse_errors,
    },
  };
}

const PATH_MENTION = /[\w@.-]+(?:\/[\w@.-]+)+/g;
const QUOTED = String.raw`(['"\x60])([^'"\x60\n]+)\1`;
/** `from 'p'`, `import('p')`, `require('p')`. */
const LOADER_SPECIFIER = new RegExp(
  String.raw`(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)` + QUOTED,
  'g',
);
/** `new URL('p', import.meta.url)`, resolved from the test file. */
const URL_SPECIFIER = new RegExp(
  String.raw`\bnew URL\(\s*${QUOTED}\s*,\s*import\.meta\.url\s*\)`,
  'g',
);
/** `join(__dirname, '..', 'dist', 'cli.js')` built only from literals. */
const ANCHORED_JOIN =
  /\b(?:join|resolve)\(\s*(?:import\.meta\.dirname|__dirname)\s*((?:,\s*(['"`])[^'"`\n]*\2\s*)+),?\s*\)/g;
/** A subprocess call name, also as `promisify(execFile)(...)`. */
const PROCESS_CALL =
  /\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork|execa|execaNode|Worker|Popen|check_output|check_call|subprocess\.run|os\.system)\b[\s)]*\(/g;

/** Argument ranges of subprocess calls that are code, not text. */
function processCallSpans(scan: SourceScan): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const match of scan.code.matchAll(PROCESS_CALL)) {
    if (stringAt(scan, match.index)) continue;
    const open = match.index + match[0].length - 1;
    const end = closingParen(scan, open);
    if (end !== -1) spans.push([open, end]);
  }
  return spans;
}

/** Repo paths a mention can mean: built output maps back to its source. */
function mentionCandidates(path: string): string[] {
  const normalized = posix.normalize(path);
  if (normalized.startsWith('../') || normalized === '..') return [];
  return [
    normalized,
    normalized.replace(/(^|\/)dist\//, '$1'),
    normalized.replace(/(^|\/)dist\//, '$1src/'),
  ];
}

/**
 * Module paths a test file shows evidence of loading: loader specifiers and
 * paths built from the test file's own location in its code, plus any path
 * inside a subprocess call's arguments, including a loader specifier in an
 * embedded script. Text in comments and in other strings, such as assertion
 * expectations, fixture contents and mock targets, does not count.
 */
function loadedPaths(
  testPath: string,
  content: string,
): Array<{ index: number; candidates: string[] }> {
  const testDir = posix.dirname(testPath);
  const scan = scanSource(testPath, content);
  const { code } = scan;
  const calls = processCallSpans(scan);
  const inCall = (index: number) =>
    calls.some(([start, end]) => start <= index && index < end);
  const isEvidence = (index: number) => !stringAt(scan, index) || inCall(index);
  const loads: Array<{ index: number; candidates: string[] }> = [];
  const relative = (index: number, mention: string, fromRoot: boolean) => {
    const local = /^\.{1,2}\//.test(mention)
      ? mentionCandidates(posix.join(testDir, mention))
      : [];
    const root = fromRoot
      ? mentionCandidates(mention.replace(/^(?:\.{1,2}\/)+/, ''))
      : [];
    loads.push({ index, candidates: [...local, ...root] });
  };

  for (const match of code.matchAll(LOADER_SPECIFIER)) {
    if (isEvidence(match.index)) relative(match.index, match[2], true);
  }
  for (const match of code.matchAll(URL_SPECIFIER)) {
    if (isEvidence(match.index)) relative(match.index, match[2], false);
  }
  for (const match of code.matchAll(ANCHORED_JOIN)) {
    if (!isEvidence(match.index)) continue;
    const segments = [...match[1].matchAll(/(['"`])([^'"`\n]*)\1/g)].map(
      (segment) => segment[2],
    );
    loads.push({
      index: match.index,
      candidates: mentionCandidates(posix.join(testDir, ...segments)),
    });
  }
  for (const [start, end] of calls) {
    for (const match of code.slice(start, end).matchAll(PATH_MENTION)) {
      relative(start + match.index, match[0], true);
    }
  }
  return loads;
}

/**
 * Tests that load a module by path (a subprocess script, a built `dist/`
 * file, a dynamic import string) have no static import edge. Such a test gets
 * an INFERRED `tests` edge to the module, unless an extracted edge already
 * covers the pair.
 */
function inferredTestEdges(
  paths: string[],
  categories: Map<string, string>,
  contents: Map<string, string>,
  existing: Set<string>,
): RelationshipEdge[] {
  const targets = new Map<string, string>();
  for (const path of paths) {
    if (categories.get(path) !== 'code') continue;
    targets.set(path, path);
    const built = path.replace(/\.(ts|tsx)$/, '.js');
    if (built !== path && !categories.has(built)) targets.set(built, path);
  }
  const edges: RelationshipEdge[] = [];
  for (const path of paths) {
    const content = contents.get(path);
    if (categories.get(path) !== 'test' || !content) continue;
    for (const { index, candidates } of loadedPaths(path, content)) {
      const target = candidates
        .map((candidate) => targets.get(candidate))
        .find(Boolean);
      if (!target || target === path) continue;
      const id = stableId(
        'edge',
        fileNode(path).id,
        'tests',
        fileNode(target).id,
      );
      if (existing.has(id)) continue;
      const line = content.slice(0, index).split('\n').length;
      const relationship = edge(
        fileNode(path).id,
        fileNode(target).id,
        'tests',
        path,
        line,
      );
      relationship.confidence = 'INFERRED';
      relationship.confidence_score = 0.7;
      existing.add(relationship.id);
      edges.push(relationship);
    }
  }
  return edges;
}

export async function extractProjectGraph(
  rootArg = '.',
  discoveryArg?: DiscoveryResult,
  options: { cache?: boolean } = {},
): Promise<ProjectGraph> {
  const root = resolve(rootArg);
  const discovery = discoveryArg ?? (await discoverProject(root));
  const codePaths = discovery.files
    .filter((file) => file.category === 'code' || file.category === 'test')
    .filter((file) => GRAPH_EXTENSIONS.has(file.extension))
    .map((file) => file.path);
  const knownPaths = new Set(codePaths);
  const fileCategories = new Map(
    discovery.files.map((file) => [file.path, file.category]),
  );
  const snapshot = await extractStructural(
    root,
    codePaths,
    options.cache === true,
  );
  const fragments: GraphFragment[] = [];
  for (const path of codePaths) {
    const content = snapshot.contents.get(path);
    const extracted = snapshot.files.get(path);
    if (content === undefined) continue;
    const module = moduleNode(moduleLabel(path));
    const file = fileNode(path);
    file.body_hash = sourceHash(content);
    file.search_text = content.slice(0, 16000);
    const nodes = [module, file];
    const edges = [edge(module.id, file.id, 'contains', path)];
    const sourceLines = content.split('\n');
    for (const symbol of extracted?.legacy ?? []) {
      const node = symbolNode(path, symbol);
      node.signature = symbol.signature;
      node.body_hash = sourceHash(
        sourceLines.slice(symbol.startLine - 1, symbol.endLine).join('\n'),
      );
      nodes.push(node);
      edges.push(edge(file.id, node.id, 'contains', path, symbol.startLine));
    }
    // Preserve Python's package/submodule fallback from the original extractor.
    if (path.endsWith('.py')) {
      for (const spec of extractImportSpecs(path, content)) {
        for (const target of resolveLocalImports(path, spec, knownPaths)) {
          edges.push(
            edge(file.id, fileNode(target).id, 'imports', path, spec.line),
          );
        }
      }
    }
    fragments.push({ nodes, edges, parse_errors: [] });
  }
  const fragment = mergeFragments(fragments);
  const byId = new Map(fragment.nodes.map((n) => [n.id, n]));
  const byLocation = new Map(
    fragment.nodes.map((n) => [
      JSON.stringify([n.source_file, n.label, n.source_span?.start_line]),
      n,
    ]),
  );
  const mapped = new Map<string, string>();
  for (const raw of snapshot.nodes) {
    const label =
      raw.kind === 'file'
        ? raw.path
        : raw.owner
          ? raw.owner + '#' + raw.name
          : raw.id.slice(raw.path.length + 1).replace(/\./g, '#');
    const span = /^L(\d+)-L(\d+)$/.exec(raw.span);
    const start = Number(span?.[1] ?? 1);
    const end = Number(span?.[2] ?? start);
    let node =
      raw.kind === 'file'
        ? byId.get(fileNode(raw.path).id)
        : byLocation.get(JSON.stringify([raw.path, label, start]));
    if (!node) {
      node = {
        id: stableId('symbol', raw.path, label, raw.kind),
        label,
        kind: raw.kind,
        source_file: raw.path,
        source_span: { file: raw.path, start_line: start, end_line: end },
        confidence: 'EXTRACTED',
      };
      fragment.nodes.push(node);
      byId.set(node.id, node);
      byLocation.set(JSON.stringify([raw.path, label, start]), node);
    }
    node.body_hash =
      raw.kind === 'file' ? node.body_hash : 'sha256:' + raw.body_hash;
    node.signature = raw.signature ?? undefined;
    node.search_text = raw.body_text ?? node.search_text;
    node.origin = raw.origin;
    mapped.set(raw.id, node.id);
  }
  for (const raw of snapshot.edges) {
    const source = mapped.get(raw.source);
    const target = mapped.get(raw.target);
    if (!source || !target) continue; // External modules are not local evidence.
    const sourceNode = byId.get(source)!;
    const relationship = edge(
      source,
      target,
      raw.relation,
      sourceNode.source_file,
      sourceNode.source_span?.start_line,
    );
    if (raw.confidence === 'inferred') {
      relationship.confidence = 'INFERRED';
      relationship.confidence_score = 0.7;
    }
    fragment.edges.push(relationship);
  }
  for (const relationship of fragment.edges.filter(
    (entry) => entry.relation === 'imports',
  )) {
    const source = byId.get(relationship.source);
    const target = byId.get(relationship.target);
    if (
      source?.source_file &&
      target?.source_file &&
      fileCategories.get(source.source_file) === 'test' &&
      fileCategories.get(target.source_file) === 'code'
    ) {
      fragment.edges.push(
        edge(source.id, target.id, 'tests', source.source_file),
      );
    }
  }
  fragment.edges.push(
    ...inferredTestEdges(
      codePaths,
      fileCategories,
      snapshot.contents,
      new Set(
        fragment.edges
          .filter((entry) => entry.relation === 'tests')
          .map((entry) => entry.id),
      ),
    ),
  );
  fragment.edges = [
    ...new Map(fragment.edges.map((entry) => [entry.id, entry])).values(),
  ].sort((a, b) => a.id.localeCompare(b.id));
  fragment.nodes.sort((a, b) => a.id.localeCompare(b.id));
  fragment.parse_errors.push(...snapshot.errors);
  validateGraphFragment(fragment);
  return {
    ...analyzeGraph(fragment),
    source_hashes: Object.fromEntries(
      [...snapshot.contents].map(([path, content]) => [
        path,
        sourceHash(content),
      ]),
    ),
  };
}

export function hashProjectGraph(graph: ProjectGraph): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(graph)).digest('hex')}`;
}

export async function writeGraphCache(
  rootArg: string,
  graph: ProjectGraph,
): Promise<string> {
  const root = resolve(rootArg);
  const target = join(root, GRAPH_CACHE_PATH);
  await writeJsonAtomic(target, graph);
  return GRAPH_CACHE_PATH;
}

export function formatGraphReport(root: string, graph: ProjectGraph): string {
  const lines = [
    '# Code-KG Extract',
    '',
    `Root: ${root}`,
    '',
    '## Structural Graph',
    '',
    `- Nodes: ${graph.nodes.length}`,
    `- Edges: ${graph.edges.length}`,
    `- Communities: ${graph.communities.length}`,
    `- Analysis algorithm: ${graph.analysis.algorithm}`,
    `- Parse errors: ${graph.analysis.parse_errors.length}`,
    '',
    '## Communities',
    '',
    ...(graph.communities.length
      ? graph.communities
          .slice(0, 10)
          .map(
            (community) =>
              `- ${community.label}: ${community.file_count} files, ${community.symbol_count} symbols, cohesion ${community.cohesion}`,
          )
      : ['- No communities were detected.']),
    '',
    '## God Nodes',
    '',
    ...(graph.analysis.god_nodes.length
      ? graph.analysis.god_nodes
          .slice(0, 10)
          .map((node) => `- ${node.label} (${node.kind})`)
      : ['- No high-degree nodes were detected.']),
    '',
    '## Bridge Nodes',
    '',
    ...(graph.analysis.bridges.length
      ? graph.analysis.bridges
          .slice(0, 10)
          .map((node) => `- ${node.label} (${node.kind})`)
      : ['- No bridge nodes were detected.']),
    '',
    '## Quality Gates',
    '',
    ...qualityGateWarnings(graph),
  ];
  return lines.join('\n');
}

export function qualityGateWarnings(graph: ProjectGraph): string[] {
  const warnings: string[] = [];
  for (const community of graph.communities) {
    if (community.file_count > 1 && community.cohesion < 0.35) {
      warnings.push(
        `- Low cohesion community: ${community.label} (${community.cohesion})`,
      );
    }
  }
  for (const node of graph.analysis.god_nodes.slice(0, 5)) {
    warnings.push(`- Review god node candidate: ${node.label} (${node.kind})`);
  }
  for (const error of graph.analysis.parse_errors.slice(0, 5)) {
    warnings.push(`- Parse warning: ${error}`);
  }
  if (warnings.length === 0) {
    warnings.push('- No MVP 2 quality gate warnings.');
  }
  return warnings;
}
