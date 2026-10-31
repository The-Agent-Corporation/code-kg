import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { extname } from 'node:path';
import { scanCodeRefs, type CodeRef } from '../code-refs.js';
import { walkEntries } from '../walk.js';
import { isSectionEntry } from './anchors.js';
import { filesFile, testDeclarations, type TestDeclaration } from './cards.js';
import { discoverProject } from './discovery.js';
import {
  extractProjectGraph,
  hashProjectGraph,
  qualityGateWarnings,
} from './graph.js';
import type {
  BootstrapFile,
  BootstrapPlan,
  DiscoveryResult,
  EntityNode,
  ManifestSection,
  MaterializationManifest,
  ProjectGraph,
} from './types.js';
import { clampLeadingParagraph } from './limits.js';

type MergeProposal = {
  stableId: string;
  file: string;
  status: ManifestSection['status'];
  candidatePath: string;
  reason: string;
  content: string;
};

const SECTION_HEADINGS: Record<string, string[]> = {
  lat: ['Code-KG Knowledge Base'],
  architecture: ['Architecture'],
  files: ['Source Files'],
  'cross-cutting': ['Cross-Cutting Concerns'],
  confidence: ['Confidence Review'],
  'tests.tests': ['Tests'],
};

const DEFAULT_GITIGNORE_LINES = [
  '.code-kg/cache/',
  '.code-kg/tmp/',
  'lat.md/.cache/',
];
const SOURCE_IMPORT_LIMIT = 6;

function hash(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function firstHeadingPath(content: string, fallback: string): string[] {
  const match = /^#\s+(.+)$/m.exec(content);
  return [match?.[1]?.trim() || fallback];
}

function bulletList(items: string[], fallback: string): string {
  if (items.length === 0) return `- ${fallback}`;
  return items
    .slice(0, 20)
    .map((item) => `- ${item}`)
    .join('\n');
}

function fileCategoryLine(discovery: DiscoveryResult): string {
  return [
    `${discovery.counts.code} code`,
    `${discovery.counts.test} test`,
    `${discovery.counts.document} document`,
    `${discovery.counts.config} config`,
    `${discovery.counts.asset} asset`,
  ].join(', ');
}

function graphCountLine(graph: ProjectGraph): string {
  return [
    `${graph.nodes.length} nodes`,
    `${graph.edges.length} edges`,
    `${graph.communities.length} communities`,
  ].join(', ');
}

function categoryByPath(discovery: DiscoveryResult): Map<string, string> {
  return new Map(discovery.files.map((file) => [file.path, file.category]));
}

function graphFileNodes(graph: ProjectGraph): Map<string, EntityNode> {
  return new Map(
    graph.nodes
      .filter((node) => node.kind === 'file' && node.source_file)
      .map((node) => [node.source_file!, node]),
  );
}

function localImports(
  graph: ProjectGraph,
  fileNode: EntityNode,
  direction: 'outgoing' | 'incoming',
): string[] {
  return localFileRelations(graph, fileNode, 'imports', direction);
}

function localFileRelations(
  graph: ProjectGraph,
  fileNode: EntityNode,
  relation: 'imports' | 'tests',
  direction: 'outgoing' | 'incoming',
  inferred?: boolean,
): string[] {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const relationships = graph.edges.filter((edge) => {
    if (edge.relation !== relation) return false;
    if (
      inferred !== undefined &&
      (edge.confidence === 'INFERRED') !== inferred
    ) {
      return false;
    }
    return direction === 'outgoing'
      ? edge.source === fileNode.id
      : edge.target === fileNode.id;
  });
  return relationships
    .map((edge) =>
      nodes.get(direction === 'outgoing' ? edge.target : edge.source),
    )
    .map((node) => node?.label)
    .filter((label): label is string => !!label)
    .sort();
}

function inlineCodeList(items: string[], limit: number): string {
  if (items.length === 0) return 'none detected';
  const visible = items.slice(0, limit).map((item) => `\`${item}\``);
  const remaining = items.length - visible.length;
  return remaining > 0
    ? `${visible.join(', ')}, and ${remaining} more`
    : visible.join(', ');
}

function briefInlineCodeList(items: string[]): string {
  if (items.length === 0) return 'none detected';
  const visible = items.slice(0, 2).map((item) => `\`${item}\``);
  const remaining = items.length - visible.length;
  return remaining > 0
    ? `${visible.join(', ')}, and ${remaining} more`
    : visible.join(', ');
}

function renderEntryPointFlow(
  discovery: DiscoveryResult,
  graph: ProjectGraph,
): string {
  const fileNodes = graphFileNodes(graph);
  const entrypoints = discovery.entrypoints
    .map((path) => ({ path, node: fileNodes.get(path) }))
    .filter(
      (entry): entry is { path: string; node: EntityNode } => !!entry.node,
    )
    .slice(0, 12);

  if (entrypoints.length === 0) {
    return `## Entry Point Flow

No parsed entrypoint files were available for first-hop dependency flow during bootstrap.

- No entrypoint flow was detected.
`;
  }

  return [
    '## Entry Point Flow',
    '',
    'Entry point flow lists first-hop local imports from discovered startup files so agents can follow runtime paths before opening source.',
    '',
    ...entrypoints.flatMap(({ path, node }) => {
      const imports = localImports(graph, node, 'outgoing');
      return [
        `### ${path}`,
        '',
        clampLeadingParagraph(
          `Entry point \`${path}\` imports first-hop local files including ${briefInlineCodeList(imports)}.`,
        ),
        '',
        `- Imports: ${inlineCodeList(imports, SOURCE_IMPORT_LIMIT)}`,
        '',
      ];
    }),
  ]
    .join('\n')
    .trimEnd();
}

function renderDependencyHotspots(
  discovery: DiscoveryResult,
  graph: ProjectGraph,
): string {
  const categories = categoryByPath(discovery);
  const hotspots = [...graphFileNodes(graph).entries()]
    .filter(([path]) => categories.get(path) === 'code')
    .map(([path, node]) => ({
      path,
      importedBy: localImports(graph, node, 'incoming'),
    }))
    .filter((entry) => entry.importedBy.length > 0)
    .sort(
      (a, b) =>
        b.importedBy.length - a.importedBy.length ||
        a.path.localeCompare(b.path),
    )
    .slice(0, 15);

  if (hotspots.length === 0) {
    return `## Dependency Hotspots

No source files had incoming local imports during bootstrap.

- No dependency hotspots were detected.
`;
  }

  return [
    '## Dependency Hotspots',
    '',
    'Dependency hotspots are the source files with the most local importers, the shared modules and integration points; each file card in [[files]] names its importers.',
    '',
    ...hotspots.map(
      ({ path, importedBy }) =>
        `- \`${path}\`: imported by ${importedBy.length} local ${importedBy.length === 1 ? 'file' : 'files'}`,
    ),
  ].join('\n');
}

const GENERATED_ROOT_ENTRIES: Array<[stem: string, summary: string]> = [
  ['architecture', 'Repository structure and entry points.'],
  ['files', 'One card per source and test file.'],
  ['cross-cutting', 'Shared concerns and likely integration paths.'],
  ['confidence', 'Review queue for uncertain generated knowledge.'],
  ['tests', 'Test layout and validation notes.'],
];

type RootEntry = { stem: string; summary: string };

function leadingSentence(markdown: string): string {
  const paragraph = markdown
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .filter((line) => !/^\s*(#|<!--)/.test(line))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .find(Boolean);
  if (!paragraph) return 'Curated knowledge.';
  return /^.*?[.!?](?=\s|$)/.exec(paragraph)?.[0] ?? paragraph;
}

/**
 * Hand-written files and directories at the top of `lat.md/`. The root index
 * must list them, and listing them here keeps the root generated, so its
 * snapshot keeps refreshing instead of turning into merge proposals.
 */
async function curatedRootEntries(root: string): Promise<RootEntry[]> {
  const latDir = join(root, 'lat.md');
  if (!existsSync(latDir)) return [];
  const generated = new Set(['lat', ...GENERATED_ROOT_ENTRIES.map(([s]) => s)]);
  // `check` sees lat.md/ through the same walk, so ignored files stay out.
  const indexes = new Map<string, string>();
  for (const path of await walkEntries(latDir)) {
    const [top, child, ...deeper] = path.split('/');
    if (child === undefined && top.endsWith('.md'))
      indexes.set(top.slice(0, -3), path);
    else if (child === `${top}.md` && !deeper.length) indexes.set(top, path);
  }
  const entries: RootEntry[] = [];
  for (const [stem, index] of indexes) {
    if (generated.has(stem)) continue;
    const content = await readFile(join(latDir, index), 'utf-8');
    entries.push({ stem, summary: leadingSentence(content) });
  }
  return entries.sort((a, b) => a.stem.localeCompare(b.stem));
}

function rootIndex(discovery: DiscoveryResult, curated: RootEntry[]): string {
  const links = [
    ...GENERATED_ROOT_ENTRIES.map(([stem, summary]) => ({ stem, summary })),
    ...curated,
  ].map(({ stem, summary }) => `- [[${stem}]] - ${summary}`);
  return `# Code-KG Knowledge Base

This knowledge base was bootstrapped from local repository discovery and should be curated as the code changes.

${links.join('\n')}

## Repository Snapshot

The first bootstrap found ${fileCategoryLine(discovery)} files. Treat this as a starting map, not as final architecture.
`;
}

function architectureFile(
  discovery: DiscoveryResult,
  graph: ProjectGraph,
): string {
  return `# Architecture
<!-- code-kg:id architecture.overview -->

This section summarizes the repository shape discovered during the first Code-KG bootstrap.

## Project Signals

Detected project signals help orient agents before broad source reads.

${bulletList(discovery.packageHints, 'No package manager or language manifest was detected.')}

## Entry Points

Entry points are candidate files to inspect first when source verification is needed.

${bulletList(discovery.entrypoints, 'No obvious entry points were detected during skeleton bootstrap.')}

${renderEntryPointFlow(discovery, graph)}

## File Inventory

The initial inventory groups files by broad category so later extraction can focus on high-value paths.

- Code files: ${discovery.counts.code}
- Test files: ${discovery.counts.test}
- Documentation files: ${discovery.counts.document}
- Config files: ${discovery.counts.config}
- Asset files: ${discovery.counts.asset}
- Unsupported files: ${discovery.counts.unsupported}

## Structural Graph

Code-KG extracted a deterministic structural graph with ${graphCountLine(graph)} using the ${graph.analysis.algorithm} analysis path.

## Communities

Directory-based communities provide the first subsystem map until graph clustering is available.

${bulletList(
  graph.communities
    .slice(0, 10)
    .map(
      (community) =>
        `${community.label}: ${community.file_count} files, ${community.symbol_count} symbols, cohesion ${community.cohesion}`,
    ),
  'No communities were detected during bootstrap.',
)}

## High-Degree Nodes

High-degree nodes may deserve review as important entry points, bridges, or utility hotspots.

${bulletList(
  graph.analysis.god_nodes
    .slice(0, 10)
    .map((node) => `${node.label} (${node.kind})`),
  'No high-degree nodes were detected during bootstrap.',
)}

${renderDependencyHotspots(discovery, graph)}
`;
}

function crossCuttingFile(graph: ProjectGraph): string {
  return `# Cross-Cutting Concerns
<!-- code-kg:id cross-cutting.overview -->

Cross-cutting concerns are seeded from deterministic import relationships and should be curated as agents verify behavior.

## Candidate Concerns

Use this section for auth, persistence, configuration, background work, observability, and other flows that cross module boundaries.

${bulletList(
  graph.analysis.bridges
    .slice(0, 10)
    .map((node) => `${node.label} (${node.kind})`),
  'No bridge nodes were detected during bootstrap.',
)}

## Cross-Community Imports

These imports cross the first-pass directory communities and may indicate integration paths worth documenting.

${bulletList(
  graph.analysis.surprising_connections.slice(0, 10).map((relationship) => {
    const source = graph.nodes.find((node) => node.id === relationship.source);
    const target = graph.nodes.find((node) => node.id === relationship.target);
    return `${source?.label ?? relationship.source} imports ${target?.label ?? relationship.target}`;
  }),
  'No cross-community imports were detected during bootstrap.',
)}
`;
}

function confidenceFile(): string {
  return `# Confidence Review
<!-- code-kg:id confidence.review -->

This queue tracks generated or inferred relationships that need human or agent review before they become trusted knowledge.

## Open Items

Skeleton bootstrap does not create inferred relationships, so there are no confidence items yet.
`;
}

type SpecTree = {
  /** The tests whose `@lat` comments point at this heading. */
  checks: string[];
  children: Map<string, SpecTree>;
};

function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function fileTitle(relStem: string): string {
  const name = relStem.split('/').pop() ?? relStem;
  const base = titleCase(name);
  return base.endsWith('Tests') ? base : `${base} Tests`;
}

function isSectionSpecTarget(target: string): boolean {
  if (target.includes('${')) return false;
  const [filePart, ...headingParts] = target.split('#');
  if (!filePart || headingParts.length === 0) return false;
  if (filePart.startsWith('lat.md/')) return false;
  return extname(filePart) === '';
}

function specStemForTarget(target: string, sourceFile: string): string | null {
  if (!isSectionSpecTarget(target)) return null;
  const [filePart] = target.split('#');
  if (filePart.includes('/')) return filePart;
  return sourceFile.startsWith('tests/') ? `tests/${filePart}` : filePart;
}

function specNode(tree: SpecTree, headings: string[]): SpecTree {
  let current = tree;
  for (const heading of headings) {
    let child = current.children.get(heading);
    if (!child) {
      child = { checks: [], children: new Map() };
      current.children.set(heading, child);
    }
    current = child;
  }
  return current;
}

/** The test a `@lat` comment sits on or directly above, as `file`: suite › name. */
function specCheck(ref: CodeRef, tests: TestDeclaration[]): string {
  const test = tests.find((t) => t.line >= ref.line && t.line <= ref.line + 3);
  return test
    ? `\`${ref.file}\`: ${[...test.suites, test.name].join(' › ')}`
    : `\`${ref.file}\``;
}

function renderSpecTree(tree: SpecTree, depth: number): string[] {
  const lines: string[] = [];
  for (const [heading, child] of [...tree.children.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const marker = '#'.repeat(depth);
    lines.push(`${marker} ${heading}`, '');
    const [first, ...rest] = [...new Set(child.checks)].sort();
    if (first) {
      lines.push(clampLeadingParagraph(`Checked by ${first}.`), '');
      if (rest.length)
        lines.push(...rest.map((check) => `- Also checked by ${check}`), '');
    } else {
      lines.push(
        clampLeadingParagraph(
          `Groups ${child.children.size} test ${child.children.size === 1 ? 'specification' : 'specifications'}: ${[
            ...child.children.keys(),
          ]
            .sort()
            .join('; ')}.`,
        ),
        '',
      );
    }
    lines.push(...renderSpecTree(child, depth + 1));
  }
  return lines;
}

async function codeRefSpecFiles(root: string): Promise<BootstrapFile[]> {
  const scan = await scanCodeRefs(root);
  const byStem = new Map<string, SpecTree>();
  const sources = new Map<string, TestDeclaration[]>();

  for (const ref of scan.refs) {
    const stem = specStemForTarget(ref.target, ref.file);
    if (!stem) continue;
    const headingParts = ref.target.split('#').slice(1).filter(Boolean);
    if (headingParts.length === 0) continue;
    let tree = byStem.get(stem);
    if (!tree) {
      tree = { checks: [], children: new Map() };
      byStem.set(stem, tree);
    }
    let tests = sources.get(ref.file);
    if (!tests) {
      tests = testDeclarations(
        ref.file,
        await readFile(join(root, ref.file), 'utf-8').catch(() => ''),
      );
      sources.set(ref.file, tests);
    }
    specNode(tree, headingParts).checks.push(specCheck(ref, tests));
  }

  return [...byStem.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([stem, tree]) => {
      const title = fileTitle(stem);
      const content = [
        `# ${title}`,
        '',
        'This file was generated from `@lat` backlinks in test code; each section names the test that checks it.',
        '',
        ...renderSpecTree(tree, 2),
      ].join('\n');
      return {
        path: `lat.md/${stem}.md`,
        content: content.trimEnd() + '\n',
        committed: true,
      };
    });
}

function testsIndexFile(
  discovery: DiscoveryResult,
  specFiles: BootstrapFile[],
): BootstrapFile {
  const children = specFiles
    .map((file) => file.path)
    .filter(
      (path) =>
        path.startsWith('lat.md/tests/') && path !== 'lat.md/tests/tests.md',
    )
    .map((path) => path.replace(/^lat\.md\/tests\//, '').replace(/\.md$/, ''))
    .sort();
  const listing =
    children.length === 0
      ? '- No generated test-spec files were discovered.'
      : children
          .map((child) => `- [[${child}]] - Generated test specs.`)
          .join('\n');

  return {
    path: 'lat.md/tests/tests.md',
    content: `# Tests
<!-- code-kg:id tests.tests -->

This section records the test layout discovered during bootstrap and indexes generated test specifications.

## Test Paths

These paths looked test-related during local discovery; each test file's card in [[files]] lists its tests and the files they check.

${bulletList(discovery.testPaths, 'No test paths were detected during skeleton bootstrap.')}

## Generated Test Specs

These files preserve existing \`@lat\` backlinks found in test code.

${listing}
`,
    committed: true,
  };
}

function manifest(plan: BootstrapPlan): MaterializationManifest {
  const sections: MaterializationManifest['sections'] = {};
  const graphHash = hashProjectGraph(plan.graph);
  for (const file of plan.files.filter((f) => f.committed)) {
    if (!file.path.endsWith('.md')) continue;
    const stable = file.path
      .replace(/^lat\.md\//, '')
      .replace(/\.md$/, '')
      .replace(/\//g, '.');
    const headingPath =
      SECTION_HEADINGS[stable] ?? firstHeadingPath(file.content, stable);
    const publicFile = file.path.replace(/\.md$/, '');
    const contentHash = hash(file.content);
    sections[stable] = {
      stable_id: stable,
      public_section_id: `${publicFile}#${headingPath.join('#')}`,
      file: file.path,
      heading_path: headingPath,
      status: 'generated',
      source_anchor_policy: 'coverage-only',
      source_node_ids:
        stable === 'architecture'
          ? plan.graph.nodes.map((node) => node.id)
          : stable === 'cross-cutting'
            ? plan.graph.analysis.bridges.map((node) => node.id)
            : [],
      source_spans: [],
      generated_hash: contentHash,
      current_hash: contentHash,
      last_seen_graph_hash: graphHash,
      source_hashes:
        stable === 'architecture' ? plan.graph.source_hashes : undefined,
    };
  }
  return {
    version: 1,
    tool_version: '0.1.0',
    project_root: '.',
    generated_at: new Date().toISOString(),
    sections,
    relationships: {},
    suppressed: { nodes: [], relationships: [] },
  };
}

function planManifest(plan: BootstrapPlan): MaterializationManifest {
  const file = plan.files.find(
    (entry) => entry.path === '.code-kg/materialization-manifest.json',
  );
  if (!file) throw new Error('bootstrap plan is missing manifest file');
  return JSON.parse(file.content) as MaterializationManifest;
}

async function existingManifest(
  root: string,
): Promise<MaterializationManifest | null> {
  const path = join(root, '.code-kg', 'materialization-manifest.json');
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf-8')) as MaterializationManifest;
}

function stableIdForMarkdownPath(path: string): string {
  return path
    .replace(/^lat\.md\//, '')
    .replace(/\.md$/, '')
    .replace(/\//g, '.');
}

function mergeProposalPath(stableId: string): string {
  return `.code-kg/cache/merge-proposals/${stableId}.md`;
}

async function writeMergeProposal(
  root: string,
  stableId: string,
  content: string,
): Promise<string> {
  const path = mergeProposalPath(stableId);
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf-8');
  return path;
}

async function clearMergeProposal(
  root: string,
  stableId: string,
): Promise<string[]> {
  const path = mergeProposalPath(stableId);
  if (!existsSync(join(root, path))) return [];
  await rm(join(root, path));
  return [`removed stale merge proposal ${path} for ${stableId}`];
}

async function ensureDefaultGitignore(root: string): Promise<boolean> {
  const path = join(root, '.gitignore');
  let content = '';
  if (existsSync(path)) {
    content = await readFile(path, 'utf-8');
  }

  const existing = new Set(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const missing = DEFAULT_GITIGNORE_LINES.filter((line) => !existing.has(line));
  if (missing.length === 0) return false;

  const prefix = content && !content.endsWith('\n') ? '\n' : '';
  const next = content + prefix + missing.join('\n') + '\n';
  await writeFile(path, next, 'utf-8');
  return true;
}

function mergeProposalForEditedSection(
  stableId: string,
  file: BootstrapFile,
  currentSection: ManifestSection,
  currentHash: string,
  nextSection: ManifestSection,
): MergeProposal | null {
  if (currentSection.status === 'generated') {
    if (currentHash === currentSection.generated_hash) return null;
    return {
      stableId,
      file: file.path,
      status: 'edited',
      candidatePath: mergeProposalPath(stableId),
      reason:
        'generated section was edited after the last materialization and will not be overwritten',
      content: file.content,
    };
  }

  if (
    currentSection.status === 'edited' &&
    currentHash !== nextSection.generated_hash
  ) {
    return {
      stableId,
      file: file.path,
      status: currentSection.status,
      candidatePath: mergeProposalPath(stableId),
      reason:
        'section is marked edited in the manifest and will not be overwritten',
      content: file.content,
    };
  }

  return null;
}

async function collectMergeProposals(
  plan: BootstrapPlan,
): Promise<MergeProposal[]> {
  const currentManifest = await existingManifest(plan.root);
  if (!currentManifest) return [];

  const nextManifest = planManifest(plan);
  const proposals: MergeProposal[] = [];
  for (const file of plan.files) {
    if (!file.path.endsWith('.md')) continue;
    const target = join(plan.root, file.path);
    if (!existsSync(target)) continue;

    const stableId = stableIdForMarkdownPath(file.path);
    const currentSection = currentManifest.sections[stableId];
    const nextSection = nextManifest.sections[stableId];
    if (!currentSection || !nextSection) continue;

    const currentHash = hash(await readFile(target, 'utf-8'));
    const proposal = mergeProposalForEditedSection(
      stableId,
      file,
      currentSection,
      currentHash,
      nextSection,
    );
    if (proposal) proposals.push(proposal);
  }
  return proposals;
}

export async function createBootstrapPlan(
  rootArg = '.',
): Promise<BootstrapPlan> {
  const root = resolve(rootArg);
  const discovery = await discoverProject(root);
  const graph = await extractProjectGraph(root, discovery);
  const specFiles = await codeRefSpecFiles(root);
  const files: BootstrapFile[] = [
    {
      path: 'lat.md/lat.md',
      content: rootIndex(discovery, await curatedRootEntries(root)),
      committed: true,
    },
    {
      path: 'lat.md/architecture.md',
      content: architectureFile(discovery, graph),
      committed: true,
    },
    {
      path: 'lat.md/files.md',
      content: await filesFile(root, discovery, graph),
      committed: true,
    },
    {
      path: 'lat.md/cross-cutting.md',
      content: crossCuttingFile(graph),
      committed: true,
    },
    {
      path: 'lat.md/confidence.md',
      content: confidenceFile(),
      committed: true,
    },
    testsIndexFile(discovery, specFiles),
    ...specFiles,
  ];
  const plan = { root, discovery, graph, files };
  files.push({
    path: '.code-kg/materialization-manifest.json',
    content: JSON.stringify(manifest(plan), null, 2) + '\n',
    committed: true,
  });
  return plan;
}

export function formatBootstrapPreview(plan: BootstrapPlan): string {
  const lines = [
    '# Code-KG Bootstrap Preview',
    '',
    `Root: ${plan.root}`,
    '',
    '## Discovery',
    '',
    `- ${fileCategoryLine(plan.discovery)}`,
    `- Package signals: ${plan.discovery.packageHints.length || 0}`,
    `- Entry points: ${plan.discovery.entrypoints.length || 0}`,
    `- Test paths: ${plan.discovery.testPaths.length || 0}`,
    '',
    '## Structural Graph',
    '',
    `- ${graphCountLine(plan.graph)}`,
    `- Analysis algorithm: ${plan.graph.analysis.algorithm}`,
    `- Parse errors: ${plan.graph.analysis.parse_errors.length}`,
    '',
    '## Quality Gates',
    '',
    ...qualityGateWarnings(plan.graph),
    '',
    '## Files To Write',
    '',
    ...plan.files.map((file) => `- ${file.path}`),
    '',
    'Run `code-kg bootstrap --accept` to write these files.',
  ];
  return lines.join('\n');
}

export async function formatMaterializationPreview(
  plan: BootstrapPlan,
): Promise<string> {
  const proposals = await collectMergeProposals(plan);
  const base = formatBootstrapPreview(plan);
  if (proposals.length === 0) return base;

  const lines = [
    base,
    '',
    '## Merge Proposals',
    '',
    ...proposals.flatMap((proposal) => [
      `- ${proposal.stableId}: ${proposal.file} is ${proposal.status}; candidate would be available at ${proposal.candidatePath}.`,
      `  Reason: ${proposal.reason}.`,
      '  Action: review the candidate and merge manually; the current file will not be overwritten.',
    ]),
  ];
  return lines.join('\n');
}

// @lat: [[lat.md/concepts#Concepts#Merge-Safe Materialization]]
export async function writeBootstrapPlan(
  plan: BootstrapPlan,
): Promise<string[]> {
  const currentManifest = await existingManifest(plan.root);
  const nextManifest = planManifest(plan);
  if (currentManifest) {
    nextManifest.relationships = currentManifest.relationships;
    nextManifest.suppressed = currentManifest.suppressed;
    for (const [id, section] of Object.entries(currentManifest.sections))
      if (isSectionEntry(section)) nextManifest.sections[id] ??= section;
  }

  const written: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const mergeProposals: string[] = [];
  for (const file of plan.files) {
    if (file.path === '.code-kg/materialization-manifest.json') continue;
    const target = join(plan.root, file.path);
    if (existsSync(target)) {
      if (!file.path.endsWith('.md')) {
        skipped.push(file.path);
        continue;
      }

      const stableId = stableIdForMarkdownPath(file.path);
      const currentSection = currentManifest?.sections[stableId];
      const nextSection = nextManifest.sections[stableId];
      const currentContent = await readFile(target, 'utf-8');
      const currentHash = hash(currentContent);

      if (!currentSection || !nextSection) {
        skipped.push(file.path);
        continue;
      }

      if (currentSection.status !== 'generated') {
        const proposal = mergeProposalForEditedSection(
          stableId,
          file,
          currentSection,
          currentHash,
          nextSection,
        );
        if (proposal) {
          const proposalPath = await writeMergeProposal(
            plan.root,
            stableId,
            file.content,
          );
          mergeProposals.push(`merge proposal ${proposalPath} for ${stableId}`);
        } else {
          mergeProposals.push(
            ...(await clearMergeProposal(plan.root, stableId)),
          );
        }
        nextManifest.sections[stableId] = {
          ...currentSection,
          current_hash: currentHash,
        };
        skipped.push(`kept ${currentSection.status} ${file.path}`);
        continue;
      }

      if (currentHash !== currentSection.generated_hash) {
        const proposalPath = await writeMergeProposal(
          plan.root,
          stableId,
          file.content,
        );
        mergeProposals.push(`merge proposal ${proposalPath} for ${stableId}`);
        nextManifest.sections[stableId] = {
          ...currentSection,
          status: 'edited',
          current_hash: currentHash,
        };
        skipped.push(`kept edited ${file.path}`);
        continue;
      }

      mergeProposals.push(...(await clearMergeProposal(plan.root, stableId)));
      if (currentHash !== nextSection.generated_hash) {
        await writeFile(target, file.content, 'utf-8');
        updated.push(file.path);
      } else {
        skipped.push(file.path);
      }
      continue;
    }

    if (file.path.endsWith('.md') && currentManifest) {
      const stableId = stableIdForMarkdownPath(file.path);
      const currentSection = currentManifest.sections[stableId];
      if (currentSection?.status === 'generated') {
        nextManifest.sections[stableId] = {
          ...currentSection,
          status: 'orphaned',
        };
        skipped.push(`marked orphaned ${file.path}`);
        continue;
      }
    }

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf-8');
    written.push(file.path);
  }

  const manifestTarget = join(
    plan.root,
    '.code-kg',
    'materialization-manifest.json',
  );
  // Keep the timestamp when nothing else changed, so a no-op update leaves
  // the committed manifest untouched.
  const unchanged =
    currentManifest &&
    (await readFile(manifestTarget, 'utf-8')) ===
      JSON.stringify(
        { ...nextManifest, generated_at: currentManifest.generated_at },
        null,
        2,
      ) +
        '\n';
  if (unchanged) {
    skipped.push('.code-kg/materialization-manifest.json');
  } else {
    await mkdir(dirname(manifestTarget), { recursive: true });
    await writeFile(
      manifestTarget,
      JSON.stringify(nextManifest, null, 2) + '\n',
      'utf-8',
    );
    if (currentManifest) {
      updated.push('.code-kg/materialization-manifest.json');
    } else {
      written.push('.code-kg/materialization-manifest.json');
    }
  }

  if (await ensureDefaultGitignore(plan.root)) {
    updated.push('.gitignore');
  }

  return [
    ...written.map((path) => `created ${path}`),
    ...updated.map((path) => `updated ${path}`),
    ...skipped.map((path) =>
      /^(kept|marked) /.test(path) ? path : `kept existing ${path}`,
    ),
    ...mergeProposals,
  ];
}
