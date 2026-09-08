import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CmdContext, CmdResult } from '../context.js';
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
  if (write) {
    section.source_hashes = Object.fromEntries(
      files.map((f) => [f, graph.source_hashes![f]]),
    );
    section.current_hash = sourceHash(content);
    section.status = 'curated';
    await writeJsonAtomic(path, manifest);
  }
  return {
    output:
      (write ? 'Acknowledged' : 'Would acknowledge') +
      ' source review for ' +
      stableId +
      ' (' +
      files.length +
      ' files).\n' +
      'Section prose and relationship confidence are unchanged.',
  };
}
