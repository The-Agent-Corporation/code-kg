import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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

/** Question words that match nearly every section's prose. */
export const STOP_WORDS = new Set(
  'a an and are as at be by can do does for from how i in is it its of on or that the this to what when where which who why with'.split(
    ' ',
  ),
);

/** A camelCase, PascalCase or snake_case name, or a dotted or slashed path. */
const IDENTIFIER =
  /^[\w$#.:/-]*([a-z][A-Z]|[A-Za-z0-9]_[A-Za-z0-9]|\w[./#]\w)[\w$#.:/-]*$/;

/**
 * True for queries made only of code names or paths, such as `writeJsonAtomic`
 * or `src/codekg/cache.ts`. Embeddings know little about these, so semantic
 * matches for them are mostly noise.
 */
export function isIdentifierQuery(query: string): boolean {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => IDENTIFIER.test(token));
}

function scoreSection(section: Section, query: string, body = ''): number {
  const q = query.toLowerCase();
  const id = section.id.toLowerCase();
  const heading = section.heading.toLowerCase();
  const lead = section.firstParagraph.toLowerCase();
  const text = body.toLowerCase();
  let score = 0;
  if (id.includes(q)) score += 8;
  if (heading.includes(q)) score += 6;
  if (lead.includes(q)) score += 4;
  const tokens = new Set(
    q.split(/\s+/).filter((token) => token && !STOP_WORDS.has(token)),
  );
  for (const token of tokens) {
    if (id.includes(token)) score += 2;
    if (heading.includes(token)) score += 2;
    if (lead.includes(token)) score += 1;
    if (text.includes(token)) score += 1;
  }
  return score;
}

/** Each section's text below its heading, keyed by section id. */
export async function readSectionBodies(
  latDir: string,
  sections: Section[],
): Promise<Map<string, string>> {
  const root = dirname(latDir);
  const files = new Map<string, string[]>();
  const bodies = new Map<string, string>();
  for (const section of sections) {
    let lines = files.get(section.filePath);
    if (!lines) {
      lines = (await readFile(join(root, section.filePath), 'utf8')).split(
        '\n',
      );
      files.set(section.filePath, lines);
    }
    bodies.set(
      section.id,
      lines.slice(section.startLine, section.endLine).join('\n'),
    );
  }
  return bodies;
}

/** Sections matching `query` lexically, best first. */
// @lat: [[lat.md/concepts#Concepts#Search Backends]]
export function rankSectionsLexically(
  sections: Section[],
  query: string,
  limit: number,
  bodies: Map<string, string> = new Map(),
): Section[] {
  return sections
    .map((section) => ({
      section,
      score: scoreSection(section, query, bodies.get(section.id)),
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
    await readSectionBodies(ctx.latDir, sections),
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
  query = '',
): SearchBackendSelection {
  if (opts.semantic || opts.backend === 'semantic') {
    return { backend: 'semantic', label: 'semantic' };
  }
  if (opts.backend === 'auto-semantic') {
    if (isIdentifierQuery(query)) {
      return {
        backend: 'local',
        label: 'local lexical (auto-semantic; identifier query)',
      };
    }
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
  const selected = selectCodeKgSearchBackend(opts, query);
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
