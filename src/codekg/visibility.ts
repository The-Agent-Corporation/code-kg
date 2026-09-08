import { join } from 'node:path';
import { readJson } from './cache.js';
import type { MaterializationManifest, ProjectGraph } from './types.js';

export async function visibleGraph(
  root: string,
  graph: ProjectGraph,
): Promise<ProjectGraph> {
  const manifest = await readJson<MaterializationManifest>(
    join(root, '.code-kg/materialization-manifest.json'),
  );
  const hidden = new Set(manifest?.suppressed?.nodes ?? []);
  const hiddenFiles = new Set(
    graph.nodes
      .filter((n) => n.kind === 'file' && hidden.has(n.id))
      .map((n) => n.source_file),
  );
  const nodes = graph.nodes.filter(
    (n) => !hidden.has(n.id) && !hiddenFiles.has(n.source_file),
  );
  const ids = new Set(nodes.map((n) => n.id));
  const blocked = new Set(manifest?.suppressed?.relationships ?? []);
  const decisions = new Set<string>();
  for (const [id, rel] of Object.entries(manifest?.relationships ?? {})) {
    if (rel.status !== 'rejected' && rel.status !== 'suppressed') continue;
    blocked.add(id);
    if (rel.source_node_id && rel.target_node_id && rel.relation)
      decisions.add(
        JSON.stringify([rel.source_node_id, rel.target_node_id, rel.relation]),
      );
  }
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter(
      (e) =>
        ids.has(e.source) &&
        ids.has(e.target) &&
        !blocked.has(e.id) &&
        !decisions.has(JSON.stringify([e.source, e.target, e.relation])),
    ),
  };
}
