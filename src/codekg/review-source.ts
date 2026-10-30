import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CmdContext, CmdResult } from '../context.js';
import { sourceAnchorPolicy } from './anchors.js';
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
  const missing = files.filter((f) => !graph.source_hashes?.[f]);
  if (missing.length)
    return {
      output:
        'Resolve missing source coverage before review: ' + missing.join(', '),
      isError: true,
    };
  if (!files.length)
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
  if (write) {
    if (staleSpanFiles.length) section.source_anchor_policy = 'coverage-only';
    section.source_hashes = Object.fromEntries(
      files.map((f) => [f, graph.source_hashes![f]]),
    );
    section.current_hash = sourceHash(content);
    section.status = 'curated';
    await writeJsonAtomic(path, manifest, 2);
  }
  const downgrade = staleSpanFiles.length
    ? '\n' +
      (write ? 'Downgraded ' : 'Would downgrade ') +
      stableId +
      ' to coverage-only: its edit-safe source spans were recorded against older content of ' +
      staleSpanFiles.join(', ') +
      '. Record fresh spans before marking it edit-safe again.'
    : '';
  return {
    output:
      (write ? 'Acknowledged' : 'Would acknowledge') +
      ' source review for ' +
      stableId +
      ' (' +
      files.length +
      ' files).\n' +
      'Section prose and relationship confidence are unchanged.' +
      downgrade,
  };
}
