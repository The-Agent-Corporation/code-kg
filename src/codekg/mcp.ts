import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { expandCommand } from '../cli/expand.js';
import { locateCommand } from '../cli/locate.js';
import { refsCommand, type Scope } from '../cli/refs.js';
import { sectionCommand } from '../cli/section.js';
import { plainStyler, type CmdContext, type CmdResult } from '../context.js';
import { findLatticeDir } from '../lattice.js';
import { applyBacklinksCommand } from './backlinks.js';
import { codeKgCheckCommand } from './check.js';
import { confidenceCommand } from './confidence.js';
import { driftCommand } from './drift.js';
import { codeKgSearchCommand } from './search.js';
import { suppressCommand } from './suppress.js';
import {
  askCommand,
  mapCommand,
  skeletonCommand,
  grepCommand,
  traceCommand,
} from './query.js';
import { contextCommand } from './context.js';
import { changedCommand } from './changed.js';
import { gapsCommand } from './gaps.js';
import {
  workAcceptCommand,
  workAnswerCommand,
  workAssumeCommand,
  workClaimCommand,
  workCloseCommand,
  workCreateCommand,
  workInterviewCommand,
  workPrimeCommand,
  workReadyCommand,
  workSealCommand,
  workShowCommand,
  workStartCommand,
  workVerifyCommand,
} from './work.js';
import { workspaceAskCommand, workspacePath } from './workspace.js';

type BudgetOptions = {
  maxTokens?: number;
};

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function applyTokenBudget(text: string, opts: BudgetOptions = {}): string {
  const originalTokens = estimateTokens(text);
  const maxTokens = opts.maxTokens;
  let body = text;
  let truncated = false;

  if (maxTokens !== undefined && originalTokens > maxTokens) {
    const maxChars = Math.max(80, maxTokens * 4);
    body = text.slice(0, maxChars).trimEnd() + '\n\n[truncated by max_tokens]';
    truncated = true;
  }

  const returnedTokens = estimateTokens(body);
  const budgetRemaining =
    maxTokens === undefined
      ? 'unknown'
      : Math.max(0, maxTokens - returnedTokens);
  return [
    body,
    '',
    '## Budget',
    '',
    `- estimated_tokens: ${originalTokens}`,
    `- returned_tokens: ${returnedTokens}`,
    `- max_tokens: ${maxTokens ?? 'unspecified'}`,
    `- budget_remaining: ${budgetRemaining}`,
    `- truncated: ${truncated ? 'yes' : 'no'}`,
  ].join('\n');
}

function toMcp(result: CmdResult, opts?: BudgetOptions) {
  const text = opts ? applyTokenBudget(result.output, opts) : result.output;
  const content = [{ type: 'text' as const, text }];
  return result.isError ? { content, isError: true } : { content };
}

export function createCodeKgMcpServer(ctx: CmdContext): McpServer {
  const server = new McpServer({
    name: 'code-kg',
    version: '0.1.0',
  });

  server.tool(
    'codekg_locate',
    'Find sections by name, path, or heading before reading source files',
    { query: z.string().describe('Section name or id to search for') },
    async ({ query }) => toMcp(await locateCommand(ctx, query)),
  );

  server.tool(
    'codekg_section',
    'Show one section with outgoing and incoming references',
    {
      query: z.string().describe('Section id to look up, short or full form'),
      max_tokens: z
        .number()
        .optional()
        .describe('Approximate maximum tokens to return'),
    },
    async ({ query, max_tokens }) =>
      toMcp(await sectionCommand(ctx, query), { maxTokens: max_tokens }),
  );

  server.tool(
    'codekg_search',
    'Search across curated lat.md sections with local lexical search by default, semantic embedding search when requested, or auto-semantic fallback',
    {
      query: z.string().describe('Search query in natural language'),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe('Max results, default 5'),
      backend: z
        .enum(['local', 'semantic', 'auto-semantic', 'hybrid'])
        .optional()
        .default('local')
        .describe(
          'Search backend: local lexical, semantic embeddings, or auto-semantic fallback',
        ),
      max_tokens: z
        .number()
        .optional()
        .describe('Approximate maximum tokens to return'),
    },
    async ({ query, limit, backend, max_tokens }) =>
      toMcp(await codeKgSearchCommand(ctx, query, { backend, limit }), {
        maxTokens: max_tokens,
      }),
  );

  server.tool(
    'codekg_expand',
    'Expand [[refs]] in text to resolved lat.md section paths with bounded context',
    { text: z.string().describe('Text containing [[refs]] to expand') },
    async ({ text: input }) => toMcp(await expandCommand(ctx, input)),
  );

  server.tool(
    'codekg_check',
    'Validate markdown, links, source refs, and directory indexes in lat.md',
    {},
    async () => toMcp(await codeKgCheckCommand(ctx)),
  );

  server.tool(
    'codekg_refs',
    'Find sections that reference a given section via wiki links or @lat code comments',
    {
      query: z.string().describe('Section id to find references for'),
      scope: z
        .enum(['md', 'code', 'md+code'])
        .optional()
        .default('md+code')
        .describe('Where to search: md, code, or md+code'),
    },
    async ({ query, scope }) =>
      toMcp(await refsCommand(ctx, query, scope as Scope)),
  );

  server.tool(
    'codekg_confidence',
    'List, accept, reject, or reconcile manifest confidence review items',
    {
      action: z
        .enum(['list', 'accept', 'reject', 'reconcile'])
        .describe('Confidence action to perform'),
      relationship_id: z
        .string()
        .optional()
        .describe('Relationship id for accept or reject'),
      accept_promotions: z
        .boolean()
        .optional()
        .describe('For reconcile, mark removed annotations accepted'),
    },
    async ({ action, relationship_id, accept_promotions }) =>
      toMcp(
        await confidenceCommand(ctx, {
          action,
          relationshipId: relationship_id,
          acceptPromotions: accept_promotions,
        }),
      ),
  );

  server.tool(
    'codekg_suppress',
    'List, add, or clear Code-KG suppression tombstones',
    {
      action: z
        .enum(['list', 'node', 'relationship', 'clear'])
        .describe('Suppression action to perform'),
      id: z.string().optional().describe('Node, relationship, or tombstone id'),
    },
    async ({ action, id }) =>
      toMcp(
        await suppressCommand(ctx, {
          action,
          id,
        }),
      ),
  );

  server.tool(
    'codekg_drift',
    'Report drift between source code, lat.md sections, and Code-KG manifest state',
    {
      apply_safe: z
        .boolean()
        .optional()
        .describe('Apply narrow safe manifest metadata updates'),
    },
    async ({ apply_safe }) =>
      toMcp(await driftCommand(ctx, { applySafe: apply_safe === true })),
  );

  server.tool(
    'codekg_apply_backlinks',
    'Preview or insert edit-safe @lat source backlinks',
    {
      write: z
        .boolean()
        .optional()
        .describe('Set true to mutate source files; omitted means preview'),
    },
    async ({ write }) =>
      toMcp(await applyBacklinksCommand(ctx, { write: write === true })),
  );

  const budget = z.number().int().min(64).max(32000).optional();
  server.tool(
    'codekg_workspace_ask',
    'Search explicitly registered repositories; scope with repository-name/path',
    {
      query: z.string().min(1),
      in: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      source: z.boolean().optional(),
      semantic: z.boolean().optional(),
      max_tokens: budget,
    },
    async ({ query, max_tokens, ...opts }) =>
      toMcp(
        await workspaceAskCommand(ctx, query, {
          ...opts,
          maxTokens: max_tokens,
        }),
      ),
  );
  server.tool(
    'codekg_ask',
    'Retrieve reviewed knowledge plus fresh source, ranked by lexical relevance, local semantic search, and dependencies',
    {
      query: z.string().min(1),
      in: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      source: z.boolean().optional(),
      semantic: z.boolean().optional(),
      max_tokens: budget,
    },
    async ({ query, max_tokens, ...opts }) =>
      toMcp(await askCommand(ctx, query, { ...opts, maxTokens: max_tokens })),
  );
  server.tool(
    'codekg_trace_calls',
    'Trace callers, callees, references, and transitive impact; inferred edges remain labeled',
    {
      query: z.string().min(1),
      direction: z.enum(['in', 'out']).optional(),
      depth: z
        .union([z.number().int().min(1).max(100), z.literal('all')])
        .optional(),
      in: z.string().optional(),
      max_tokens: budget,
    },
    async ({ query, depth, max_tokens, ...opts }) =>
      toMcp(
        await traceCommand(ctx, query, {
          ...opts,
          depth: depth === 'all' ? Infinity : depth,
          maxTokens: max_tokens,
        }),
      ),
  );
  server.tool(
    'codekg_repo_map',
    'Read a bounded source map and dependency hotspots',
    {
      in: z.string().optional(),
      max_tokens: budget,
    },
    async ({ max_tokens, ...opts }) =>
      toMcp(await mapCommand(ctx, { ...opts, maxTokens: max_tokens })),
  );
  server.tool(
    'codekg_file_api',
    'Read signatures and symbol locations in a file',
    {
      file: z.string(),
      max_tokens: budget,
    },
    async ({ file, max_tokens }) =>
      toMcp(await skeletonCommand(ctx, file, { maxTokens: max_tokens })),
  );
  server.tool(
    'codekg_find_all',
    'Find all literal or regex occurrences in indexed source; output reports total matches even when bounded',
    {
      pattern: z.string().min(1),
      in: z.string().optional(),
      regex: z.boolean().optional(),
      ignore_case: z.boolean().optional(),
      max_tokens: budget,
    },
    async ({ pattern, ignore_case, max_tokens, ...opts }) =>
      toMcp(
        await grepCommand(ctx, pattern, {
          ...opts,
          ignoreCase: ignore_case,
          maxTokens: max_tokens,
        }),
      ),
  );
  server.tool(
    'codekg_context',
    'Map a source file or symbol to knowledge sections and test relationships',
    {
      query: z.string(),
    },
    async ({ query }) => toMcp(await contextCommand(ctx, query)),
  );
  server.tool(
    'codekg_changed',
    'Map working-tree changes to knowledge sections and tests',
    {},
    async () => toMcp(await changedCommand(ctx)),
  );

  server.tool(
    'codekg_work_ready',
    'List unblocked open agent work items',
    {
      json: z.boolean().optional(),
    },
    async ({ json }) => toMcp(await workReadyCommand(ctx, { json })),
  );
  server.tool(
    'codekg_work_show',
    'Show one agent work item',
    {
      id: z.string(),
      json: z.boolean().optional(),
    },
    async ({ id, json }) => toMcp(await workShowCommand(ctx, { id, json })),
  );
  server.tool(
    'codekg_work_create',
    'Create an agent work item (use instead of markdown TODOs)',
    {
      title: z.string(),
      description: z.string().optional(),
      type: z.string().optional(),
      priority: z.number().optional(),
      parent: z.string().optional(),
      deps: z.array(z.string()).optional(),
      discovered_from: z.string().optional(),
      queries: z.array(z.string()).optional(),
      section_ids: z.array(z.string()).optional(),
      source_paths: z.array(z.string()).optional(),
      assumptions: z.array(z.string()).optional(),
      acceptance: z.array(z.string()).optional(),
      interview: z.boolean().optional(),
      json: z.boolean().optional(),
    },
    async (args) =>
      toMcp(
        await workCreateCommand(ctx, {
          title: args.title,
          description: args.description,
          type: args.type,
          priority: args.priority,
          parent: args.parent,
          deps: args.deps,
          discoveredFrom: args.discovered_from,
          queries: args.queries,
          sectionIds: args.section_ids,
          sourcePaths: args.source_paths,
          assumptions: args.assumptions,
          acceptance: args.acceptance,
          interview: args.interview,
          json: args.json,
        }),
      ),
  );
  server.tool(
    'codekg_work_claim',
    'Claim a ready work item',
    {
      id: z.string(),
      assignee: z.string().optional(),
      json: z.boolean().optional(),
    },
    async ({ id, assignee, json }) =>
      toMcp(await workClaimCommand(ctx, { id, assignee, json })),
  );
  server.tool(
    'codekg_work_start',
    'Claim a work item and prime it from the Code-KG knowledge graph before coding',
    {
      id: z.string(),
      assignee: z.string().optional(),
      max_tokens: z.number().optional(),
      json: z.boolean().optional(),
    },
    async ({ id, assignee, max_tokens, json }) =>
      toMcp(
        await workStartCommand(ctx, {
          id,
          assignee,
          maxTokens: max_tokens,
          json,
        }),
      ),
  );
  server.tool(
    'codekg_work_close',
    'Close a finished work item (requires pass verification unless force)',
    {
      id: z.string(),
      reason: z.string().optional(),
      force: z.boolean().optional(),
      allow_inconclusive: z.boolean().optional(),
      json: z.boolean().optional(),
    },
    async ({ id, reason, force, allow_inconclusive, json }) =>
      toMcp(
        await workCloseCommand(ctx, {
          id,
          reason,
          force,
          allowInconclusive: allow_inconclusive,
          json,
        }),
      ),
  );
  server.tool(
    'codekg_work_verify',
    'Record a Reticle-style pass/fail/inconclusive verification before close',
    {
      id: z.string(),
      verdict: z.string(),
      summary: z.string(),
      method: z.string().optional(),
      checks: z.array(z.string()).optional(),
      evidence_ids: z.array(z.string()).optional(),
      json: z.boolean().optional(),
    },
    async ({ id, verdict, summary, method, checks, evidence_ids, json }) =>
      toMcp(
        await workVerifyCommand(ctx, {
          id,
          verdict,
          summary,
          method,
          check: checks,
          evidenceId: evidence_ids,
          json,
        }),
      ),
  );
  server.tool(
    'codekg_work_interview',
    'Generate or show clarifying interview questions for a work item',
    {
      id: z.string(),
      refresh: z.boolean().optional(),
      json: z.boolean().optional(),
    },
    async ({ id, refresh, json }) =>
      toMcp(await workInterviewCommand(ctx, { id, refresh, json })),
  );
  server.tool(
    'codekg_work_answer',
    'Answer an interview question on a work item',
    {
      id: z.string(),
      question: z.string(),
      answer: z.string(),
      json: z.boolean().optional(),
    },
    async ({ id, question, answer, json }) =>
      toMcp(await workAnswerCommand(ctx, { id, question, answer, json })),
  );
  server.tool(
    'codekg_work_assume',
    'Record an assumption on a work item',
    {
      id: z.string(),
      text: z.string(),
      json: z.boolean().optional(),
    },
    async ({ id, text, json }) =>
      toMcp(await workAssumeCommand(ctx, { id, text, json })),
  );
  server.tool(
    'codekg_work_accept',
    'Add an acceptance criterion kept separate from the build brief',
    {
      id: z.string(),
      criterion: z.string(),
      json: z.boolean().optional(),
    },
    async ({ id, criterion, json }) =>
      toMcp(await workAcceptCommand(ctx, { id, criterion, json })),
  );
  server.tool(
    'codekg_work_seal',
    'Seal interview/acceptance before implementation',
    {
      id: z.string(),
      force: z.boolean().optional(),
      json: z.boolean().optional(),
    },
    async ({ id, force, json }) =>
      toMcp(await workSealCommand(ctx, { id, force, json })),
  );
  server.tool(
    'codekg_work_prime',
    'Session orientation: ready/in-progress work plus knowledge-graph context',
    {
      max_tokens: z.number().optional(),
      json: z.boolean().optional(),
    },
    async ({ max_tokens, json }) =>
      toMcp(await workPrimeCommand(ctx, { maxTokens: max_tokens, json })),
  );

  server.tool(
    'codekg_gaps',
    'Report missing source documentation and test relationships',
    {},
    async () => toMcp(await gapsCommand(ctx)),
  );
  return server;
}

export async function startCodeKgMcpServer(): Promise<void> {
  const latDir =
    findLatticeDir() ??
    (existsSync(workspacePath(process.cwd()))
      ? join(process.cwd(), 'lat.md')
      : null);
  if (!latDir) {
    process.stderr.write('No lat.md directory found\n');
    process.exit(1);
  }
  const projectRoot = dirname(latDir);
  const ctx: CmdContext = {
    latDir,
    projectRoot,
    styler: plainStyler,
    mode: 'mcp',
  };

  const server = createCodeKgMcpServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
