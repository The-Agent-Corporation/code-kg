import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CmdContext, CmdResult } from '../context.js';
import { findSections, loadAllSections, type Section } from '../lattice.js';
import {
  anchorName,
  anchorSpan,
  isSectionEntry,
  sourceAnchor,
} from './anchors.js';
import { readJson, writeJsonAtomic } from './cache.js';
import { freshGraph } from './fresh.js';
import { sourceHash } from './structural.js';
import type {
  EntityNode,
  ManifestSection,
  MaterializationManifest,
  ProjectGraph,
  SourceAnchor,
} from './types.js';
import { visibleGraph } from './visibility.js';

export type AnchorOptions = {
  action: 'add' | 'remove' | 'list';
  target?: string;
};

function reply(lines: string[], isError = false): CmdResult {
  return { output: ['# Code-KG Anchor', '', ...lines].join('\n'), isError };
}

const quote = (id: string) => JSON.stringify(id);

async function resolveSection(
  latDir: string,
  query: string,
): Promise<Section | string> {
  const matches = findSections(
    await loadAllSections(latDir),
    query.replace(/^\[\[|\]\]$/g, ''),
  );
  const confident = [
    ...new Map(
      matches
        .filter(
          ({ reason }) =>
            reason === 'exact match' ||
            reason === 'section name match' ||
            reason.startsWith('file stem expanded'),
        )
        .map(({ section }) => [section.id, section]),
    ).values(),
  ];
  if (confident.length === 1) return confident[0];
  if (confident.length > 1)
    return `${query} names several sections: ${confident.map((s) => s.id).join(', ')}.`;
  const close = matches.slice(0, 5).map(({ section }) => section.id);
  return (
    `No section matches ${query}.` +
    (close.length ? ` Closest: ${close.join(', ')}.` : '')
  );
}

/** Accepts a node id, `<file>#<symbol>`, a file path, or a unique symbol name. */
function resolveNode(graph: ProjectGraph, query: string): EntityNode | string {
  const q = query
    .replace(/^\[\[|\]\]$/g, '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
  const nodes = graph.nodes.filter((node) => node.kind !== 'module');
  const exact = nodes.find(
    (node) => node.id === q || (node.kind === 'file' && node.source_file === q),
  );
  if (exact) return exact;
  const hash = q.indexOf('#');
  const file = hash > 0 ? q.slice(0, hash) : '';
  const scoped = file && nodes.some((node) => node.source_file === file);
  const name = scoped ? q.slice(hash + 1) : q;
  const symbols = nodes.filter(
    (node) => node.kind !== 'file' && (!scoped || node.source_file === file),
  );
  let found = symbols.filter(
    (node) => node.label === name || node.label.replace(/#/g, '.') === name,
  );
  if (!found.length)
    found = symbols.filter((node) => node.label.endsWith('#' + name));
  if (found.length === 1) return found[0];
  if (found.length > 1)
    return [
      `${query} matches several symbols; pass one as <file>#<symbol> or by node id:`,
      ...found
        .slice(0, 10)
        .map(
          (node) =>
            `- ${anchorName(sourceAnchor(node))} (${node.kind}) ${node.id}`,
        ),
    ].join('\n');
  return `No indexed symbol or source file matches ${query}.`;
}

type Target = { key: string; entry?: ManifestSection } | { error: string };

/**
 * Generated files are rewritten by `code-kg update`, so only their own
 * curated or edited entry may carry anchors. Sections of hand-written files,
 * or below a curated or edited file entry, get an entry of their own.
 */
function targetEntry(
  manifest: MaterializationManifest,
  section: Section,
): Target {
  const fileEntry = Object.values(manifest.sections).find(
    (entry) => entry.file === section.filePath && !isSectionEntry(entry),
  );
  if (fileEntry?.status === 'generated')
    return {
      error: `${section.filePath} is generated, and \`code-kg update\` rewrites it. Anchor a section of a hand-written file, or edit this one or run \`code-kg review-source ${fileEntry.stable_id} --write\` so updates keep it.`,
    };
  if (
    fileEntry &&
    fileEntry.status !== 'curated' &&
    fileEntry.status !== 'edited'
  )
    return { error: `${section.filePath} is ${fileEntry.status}.` };
  if (fileEntry?.public_section_id === section.id)
    return { key: fileEntry.stable_id, entry: fileEntry };
  return { key: section.id, entry: manifest.sections[section.id] };
}

async function sectionEntry(
  ctx: CmdContext,
  section: Section,
): Promise<ManifestSection> {
  const content = await readFile(
    join(ctx.projectRoot, section.filePath),
    'utf8',
  );
  return {
    stable_id: section.id,
    public_section_id: section.id,
    file: section.filePath,
    heading_path: section.id.split('#').slice(1),
    status: 'curated',
    source_anchor_policy: 'edit-safe',
    source_node_ids: [],
    source_spans: [],
    source_anchors: [],
    generated_hash: '',
    current_hash: sourceHash(content),
    last_seen_graph_hash: '',
    source_hashes: {},
  };
}

function matchAnchor(
  anchors: SourceAnchor[],
  query: string,
): SourceAnchor | string {
  const q = query.replace(/\\/g, '/').replace(/^\.\//, '');
  const found = anchors.filter(
    (anchor) =>
      anchor.node_id === q ||
      anchorName(anchor) === q ||
      anchor.symbol === q ||
      !!anchor.symbol?.endsWith('#' + q),
  );
  if (found.length === 1) return found[0];
  return found.length
    ? `${query} matches several anchors: ${found.map(anchorName).join(', ')}.`
    : `The section has no anchor ${query}.`;
}

async function listAnchors(
  ctx: CmdContext,
  id: string,
  entry: ManifestSection | undefined,
): Promise<CmdResult> {
  const anchors = entry?.source_anchors ?? [];
  if (!anchors.length) return reply([`${id} has no source anchors.`]);
  const nodes = new Map(
    (await freshGraph(ctx.projectRoot)).nodes.map((node) => [node.id, node]),
  );
  return reply([
    `${id} (${entry!.source_anchor_policy ?? 'coverage-only'}):`,
    '',
    ...anchors.map((anchor) => {
      const node = nodes.get(anchor.node_id);
      const span = node && anchorSpan(node);
      if (!span)
        return `- ${anchorName(anchor)} is missing from the source; remove it with \`code-kg anchor ${quote(id)} --remove ${quote(anchor.node_id)}\``;
      return (
        `- ${anchorName(anchor)} at ${span.file}:${span.start_line}` +
        (node.body_hash === anchor.hash
          ? ''
          : ` (changed since the section was reviewed; review it, then run \`code-kg review-source ${quote(entry!.stable_id)} --write\`)`)
      );
    }),
  ]);
}

// @lat: [[lat.md/concepts#Concepts#Section Anchors]]
export async function anchorCommand(
  ctx: CmdContext,
  sectionQuery: string,
  opts: AnchorOptions,
): Promise<CmdResult> {
  const path = join(ctx.projectRoot, '.code-kg/materialization-manifest.json');
  const manifest = await readJson<MaterializationManifest>(path);
  if (!manifest)
    return reply(
      [
        '.code-kg/materialization-manifest.json is missing or not valid JSON; run code-kg bootstrap --accept to create it.',
      ],
      true,
    );
  const resolved = await resolveSection(ctx.latDir, sectionQuery);
  const orphan = manifest.sections[sectionQuery];
  let section: Section | null = null;
  let target: Target;
  if (typeof resolved !== 'string') {
    section = resolved;
    target = targetEntry(manifest, resolved);
  } else if (opts.action !== 'add' && orphan && isSectionEntry(orphan)) {
    // A section entry whose heading was renamed or deleted can still be
    // listed and emptied by its manifest key.
    target = { key: sectionQuery, entry: orphan };
  } else return reply([resolved], true);
  const id = section?.id ?? sectionQuery;
  if ('error' in target)
    return opts.action === 'list'
      ? reply([`${id} has no source anchors. ${target.error}`])
      : reply([target.error], true);
  if (opts.action === 'list') return listAnchors(ctx, id, target.entry);
  if (!opts.target)
    return reply(['Name the symbol or file to anchor, or pass --list.'], true);

  if (opts.action === 'remove') {
    const entry = target.entry;
    const anchor = matchAnchor(entry?.source_anchors ?? [], opts.target);
    if (!entry || typeof anchor === 'string')
      return reply([typeof anchor === 'string' ? anchor : 'No anchors.'], true);
    entry.source_anchors = entry.source_anchors!.filter((a) => a !== anchor);
    if (!entry.source_anchors.length) {
      delete entry.source_anchors;
      if (!entry.source_spans.length)
        entry.source_anchor_policy = 'coverage-only';
    }
    if (isSectionEntry(entry) && !entry.source_anchors)
      delete manifest.sections[target.key];
    await writeJsonAtomic(path, manifest, 2);
    return reply([`Removed anchor ${anchorName(anchor)} from ${id}.`]);
  }
  if (!section) return reply([`No section matches ${sectionQuery}.`], true);

  const graph = await visibleGraph(
    ctx.projectRoot,
    await freshGraph(ctx.projectRoot),
  );
  const node = resolveNode(graph, opts.target);
  if (typeof node === 'string') return reply([node], true);
  const span = anchorSpan(node);
  const anchor = sourceAnchor(node);
  if (!span || !anchor.hash)
    return reply([`${anchorName(anchor)} has no source location.`], true);
  const entry = target.entry ?? (await sectionEntry(ctx, section));
  if (entry.source_anchors?.some((a) => a.node_id === node.id))
    return reply([
      `${section.id} is already anchored to ${anchorName(anchor)}.`,
    ]);
  entry.source_anchors = [...(entry.source_anchors ?? []), anchor];
  entry.source_anchor_policy = 'edit-safe';
  manifest.sections[target.key] = entry;
  await writeJsonAtomic(path, manifest, 2);
  return reply([
    `Anchored ${section.id} to ${anchorName(anchor)} at ${span.file}:${span.start_line}.`,
    '',
    'Run `code-kg apply-backlinks --preview` to see the source backlink it adds.',
  ]);
}
