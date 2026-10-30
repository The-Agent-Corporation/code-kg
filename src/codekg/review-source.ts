import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CmdContext, CmdResult } from '../context.js';
import { anchorChanges, anchorName, sourceAnchorPolicy } from './anchors.js';
import { readJson, writeJsonAtomic } from './cache.js';
import { freshGraph } from './fresh.js';
import type { MaterializationManifest } from './types.js';
import { sourceHash } from './structural.js';

export async function reviewSourceCommand(
  ctx: CmdContext,
  stableId: string,
  write = false,
): Promise<CmdResult> {
  const path = join(ctx.projectRoot, '.code-kg/materialization-manifest.json');
  const manifest = await readJson<MaterializationManifest>(path);
  const section = manifest?.sections[stableId];
  if (
    !section ||
    section.status === 'suppressed' ||
    section.status === 'orphaned'
  )
    return { output: 'No active manifest section: ' + stableId, isError: true };
  const content = await readFile(join(ctx.projectRoot, section.file), 'utf8');
  const graph = await freshGraph(ctx.projectRoot);
  if (graph.analysis.parse_errors.length)
    return {
      output: 'Resolve extraction errors before acknowledging source review.',
      isError: true,
    };
  const files =
    stableId === 'architecture'
      ? Object.keys(graph.source_hashes ?? {})
      : [
          ...new Set([
            ...Object.keys(section.source_hashes ?? {}),
            ...section.source_spans.map((s) => s.file),
            ...graph.nodes
              .filter(
                (n) => section.source_node_ids.includes(n.id) && n.source_file,
              )
              .map((n) => n.source_file!),
          ]),
        ];
  const anchors = section.source_anchors ?? [];
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const { missing: goneAnchors } = anchorChanges(section, nodes);
  const missing = [
    ...files.filter((f) => !graph.source_hashes?.[f]),
    ...goneAnchors.map(anchorName),
  ];
  if (missing.length)
    return {
      output:
        'Resolve missing source coverage before review: ' + missing.join(', '),
      isError: true,
    };
  if (!files.length && !anchors.length)
    return {
      output: 'Section has no source coverage to review.',
      isError: true,
    };
  // Refreshed hashes would vouch for span line numbers recorded against older
  // content, and apply-backlinks trusts spans whose file hash matches.
  const staleSpanFiles =
    sourceAnchorPolicy(section) === 'edit-safe'
      ? [...new Set(section.source_spans.map((s) => s.file))].filter(
          (f) => section.source_hashes?.[f] !== graph.source_hashes![f],
        )
      : [];
  const keptSpans = section.source_spans.filter(
    (s) => !staleSpanFiles.includes(s.file),
  );
  const downgraded =
    staleSpanFiles.length > 0 &&
    !keptSpans.length &&
    !section.source_anchors?.length;
  if (write) {
    if (staleSpanFiles.length) section.source_spans = keptSpans;
    if (downgraded) section.source_anchor_policy = 'coverage-only';
    section.source_hashes = Object.fromEntries(
      files.map((f) => [f, graph.source_hashes![f]]),
    );
    for (const anchor of anchors)
      anchor.hash = nodes.get(anchor.node_id)!.body_hash ?? '';
    section.current_hash = sourceHash(content);
    section.status = 'curated';
    await writeJsonAtomic(path, manifest, 2);
  }
  const downgrade = staleSpanFiles.length
    ? '\n' +
      (write ? 'Dropped ' : 'Would drop ') +
      stableId +
      "'s source spans in " +
      staleSpanFiles.join(', ') +
      ': they were recorded against older content.' +
      (!downgraded
        ? ''
        : ' With no spans left, it ' +
          (write ? 'is now' : 'would become') +
          ' coverage-only. Use `code-kg anchor` to make it edit-safe with anchors that follow the source.')
    : '';
  const coverage = anchors.length
    ? [files.length && `${files.length} files`, `${anchors.length} anchors`]
        .filter(Boolean)
        .join(', ')
    : `${files.length} files`;
  return {
    output:
      (write ? 'Acknowledged' : 'Would acknowledge') +
      ' source review for ' +
      stableId +
      ' (' +
      coverage +
      ').\n' +
      'Section prose and relationship confidence are unchanged.' +
      downgrade,
  };
}
