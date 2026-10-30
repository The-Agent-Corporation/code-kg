import type { CmdContext, CmdResult } from '../context.js';
import {
  flattenSections,
  loadAllSections,
  type Section,
  type SectionMatch,
} from '../lattice.js';
import { formatNavHints, formatResultList } from '../format.js';
import { embeddingConfigError, hasEmbeddingConfig } from '../config.js';

export type CodeKgSearchBackend =
  | 'local'
  | 'semantic'
  | 'auto-semantic'
  | 'hybrid';
type ResolvedSearchBackend = 'local' | 'semantic';

export type CodeKgSearchOptions = {
  backend?: CodeKgSearchBackend;
  semantic?: boolean;
  limit?: number;
  reindex?: boolean;
};

type SearchBackendSelection = {
  backend: ResolvedSearchBackend;
  label: string;
};

function formatCodeKgNavHints(ctx: CmdContext): string {
  const s = ctx.styler;
  const hints =
    ctx.mode === 'cli'
      ? `${s.dim('*')} \`code-kg section "section#id"\` - show full content with outgoing/incoming refs\n` +
        `${s.dim('*')} \`code-kg search "new query"\` - search for something else`
      : `${s.dim('*')} \`codekg_section\` - show full content with outgoing/incoming refs\n` +
        `${s.dim('*')} \`codekg_search\` - search for something else`;
  return `\n## To navigate further:\n\n${hints}`;
}

/** Replaces the lat.md runtime's `lat section`/`lat_section` hints. */
export function withCodeKgNavHints(
  ctx: CmdContext,
  result: CmdResult,
): CmdResult {
  return {
    ...result,
    output: result.output.replace(
      formatNavHints(ctx),
      formatCodeKgNavHints(ctx),
    ),
  };
}

function scoreSection(section: Section, query: string): number {
  const q = query.toLowerCase();
  const id = section.id.toLowerCase();
  const heading = section.heading.toLowerCase();
  const body = section.firstParagraph.toLowerCase();
  let score = 0;
  if (id.includes(q)) score += 8;
  if (heading.includes(q)) score += 6;
  if (body.includes(q)) score += 4;
  for (const token of q.split(/\s+/).filter(Boolean)) {
    if (id.includes(token)) score += 2;
    if (heading.includes(token)) score += 2;
    if (body.includes(token)) score += 1;
  }
  return score;
}

/** Sections matching `query` lexically, best first. */
export function rankSectionsLexically(
  sections: Section[],
  query: string,
  limit: number,
): Section[] {
  return sections
    .map((section) => ({
      section,
      score: scoreSection(section, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.section.id.localeCompare(b.section.id),
    )
    .slice(0, limit)
    .map((entry) => entry.section);
}

export async function localSearchCommand(
  ctx: CmdContext,
  query: string | undefined,
  limit: number,
): Promise<CmdResult> {
  if (!query?.trim()) {
    return { output: 'Provide a search query.', isError: true };
  }

  const sections = flattenSections(await loadAllSections(ctx.latDir));
  const matches: SectionMatch[] = rankSectionsLexically(
    sections,
    query,
    limit,
  ).map((section) => ({ section, reason: 'local lexical match' }));

  if (matches.length === 0) {
    return {
      output: `No sections matched "${query}".`,
      isError: true,
    };
  }

  return {
    output:
      formatResultList(ctx, `Local search results for "${query}"`, matches) +
      formatCodeKgNavHints(ctx),
  };
}

function fallbackLabel(reason: string | null): string {
  if (!reason) return 'local lexical (auto-semantic fallback)';
  const brief = reason.replace(/\s+/g, ' ').trim().slice(0, 160);
  return `local lexical (auto-semantic fallback; ${brief})`;
}

export function selectCodeKgSearchBackend(
  opts: CodeKgSearchOptions = {},
): SearchBackendSelection {
  if (opts.semantic || opts.backend === 'semantic') {
    return { backend: 'semantic', label: 'semantic' };
  }
  if (opts.backend === 'auto-semantic') {
    if (hasEmbeddingConfig()) {
      return { backend: 'semantic', label: 'semantic (auto-semantic)' };
    }
    const error = embeddingConfigError();
    return { backend: 'local', label: fallbackLabel(error) };
  }
  return { backend: 'local', label: 'local lexical' };
}

async function semanticSearchCommand(
  ctx: CmdContext,
  query: string | undefined,
  limit: number,
  reindex: boolean,
): Promise<CmdResult> {
  const { cliProgress, searchCommand } = await import('../cli/search.js');
  const progress =
    ctx.mode === 'cli' ? cliProgress(reindex, ctx.styler) : undefined;
  return searchCommand(ctx, query, { limit, reindex }, progress, {
    noProvider: () =>
      'No semantic embedding provider configured. Run `code-kg semantic enable-local` for local embeddings, or provide a key via LAT_LLM_KEY, LAT_LLM_KEY_FILE, or LAT_LLM_KEY_HELPER.',
    navHints: formatCodeKgNavHints,
  });
}

function withBackendLabel(result: CmdResult, label: string): CmdResult {
  if (!result.output) return result;
  return {
    ...result,
    output: `Backend: ${label}\n${result.output}`,
  };
}

export async function codeKgSearchCommand(
  ctx: CmdContext,
  query: string | undefined,
  opts: CodeKgSearchOptions = {},
): Promise<CmdResult> {
  if (opts.backend === 'hybrid') {
    const { askCommand } = await import('./query.js');
    return askCommand(ctx, query ?? '', { limit: opts.limit });
  }
  const selected = selectCodeKgSearchBackend(opts);
  const limit = opts.limit ?? 5;

  if (selected.backend === 'semantic') {
    let result: CmdResult;
    try {
      result = await semanticSearchCommand(
        ctx,
        query,
        limit,
        opts.reindex === true,
      );
    } catch (error) {
      result = {
        output: `Semantic search failed: ${(error as Error).message}`,
        isError: true,
      };
    }
    if (result.isError && opts.backend === 'auto-semantic' && query?.trim()) {
      return withBackendLabel(
        await localSearchCommand(ctx, query, limit),
        fallbackLabel(result.output),
      );
    }
    return withBackendLabel(result, selected.label);
  }

  return withBackendLabel(
    await localSearchCommand(ctx, query, limit),
    selected.label,
  );
}
