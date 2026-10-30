import type {
  EntityNode,
  ManifestSection,
  MaterializationManifest,
  SourceAnchor,
  SourceSpan,
} from './types.js';

// @lat: [[lat.md/concepts#Concepts#Source Anchor Policies]]
export function sourceAnchorPolicy(
  section: ManifestSection,
): 'coverage-only' | 'edit-safe' {
  return section.source_anchor_policy ?? 'coverage-only';
}

export function backlinkAnchorsForSection(
  section: ManifestSection,
): SourceSpan[] {
  if (sourceAnchorPolicy(section) !== 'edit-safe') return [];
  return section.source_spans ?? [];
}

/**
 * Materialization owns one entry per knowledge file, keyed by its path.
 * `code-kg anchor` keys entries for individual sections by their section id,
 * which always contains `#`.
 */
export function isSectionEntry(section: ManifestSection): boolean {
  return section.stable_id.includes('#');
}

/** The entry for this exact section, else the entry for the file holding it. */
export function manifestOwner(
  manifest: MaterializationManifest | null | undefined,
  section: { id: string; filePath: string },
): ManifestSection | undefined {
  const entries = Object.values(manifest?.sections ?? {});
  return (
    entries.find((entry) => entry.public_section_id === section.id) ??
    entries.find(
      (entry) => entry.file === section.filePath && !isSectionEntry(entry),
    )
  );
}

export function sourceAnchor(node: EntityNode): SourceAnchor {
  const file = node.source_file ?? node.label;
  const hash = node.body_hash ?? '';
  return node.kind === 'file'
    ? { node_id: node.id, file, hash }
    : { node_id: node.id, file, symbol: node.label, hash };
}

/** Graph nodes a section documents, through coverage evidence or anchors. */
export function sectionNodeIds(section: ManifestSection): string[] {
  return [
    ...section.source_node_ids,
    ...(section.source_anchors ?? []).map((anchor) => anchor.node_id),
  ];
}

/**
 * Anchors whose node is gone, and anchors whose node's body changed since the
 * section was last reviewed against it.
 */
export function anchorChanges(
  section: ManifestSection,
  nodes: Map<string, EntityNode>,
): { missing: SourceAnchor[]; changed: SourceAnchor[] } {
  const missing: SourceAnchor[] = [];
  const changed: SourceAnchor[] = [];
  for (const anchor of section.source_anchors ?? []) {
    const node = nodes.get(anchor.node_id);
    if (!node) missing.push(anchor);
    else if (node.body_hash !== anchor.hash) changed.push(anchor);
  }
  return { missing, changed };
}

export function anchorName(anchor: SourceAnchor): string {
  return anchor.symbol ? `${anchor.file}#${anchor.symbol}` : anchor.file;
}

/** Where a backlink for an anchored node goes; files take it at the top. */
export function anchorSpan(node: EntityNode): SourceSpan | null {
  if (node.source_span) return node.source_span;
  if (node.kind === 'file' && node.source_file)
    return { file: node.source_file, start_line: 1, end_line: 1 };
  return null;
}
