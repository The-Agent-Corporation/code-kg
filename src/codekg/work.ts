import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { CmdContext, CmdResult } from '../context.js';
import { askCommand } from './query.js';

export type WorkStatus = 'open' | 'in_progress' | 'blocked' | 'closed';
export type WorkType = 'task' | 'bug' | 'feature' | 'epic' | 'chore';
export type WorkDepKind =
  | 'blocks'
  | 'parent-of'
  | 'discovered-from'
  | 'related';

export type WorkDep = {
  id: string;
  kind: WorkDepKind;
};

export type WorkItem = {
  id: string;
  title: string;
  description: string;
  type: WorkType;
  status: WorkStatus;
  priority: number;
  assignee?: string;
  parent?: string;
  deps: WorkDep[];
  queries: string[];
  section_ids: string[];
  source_paths: string[];
  context_cache?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  close_reason?: string;
};

export type WorkMemory = {
  id: string;
  text: string;
  created_at: string;
};

export type WorkCreateOptions = {
  title: string;
  description?: string;
  type?: string;
  priority?: number;
  parent?: string;
  deps?: string[];
  discoveredFrom?: string;
  queries?: string[];
  sectionIds?: string[];
  sourcePaths?: string[];
  json?: boolean;
};

export type WorkUpdateOptions = {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  priority?: number;
  status?: string;
  assignee?: string;
  addQuery?: string[];
  addSection?: string[];
  addSource?: string[];
  json?: boolean;
};

export type WorkListOptions = {
  status?: string;
  json?: boolean;
};

export type WorkIdOptions = {
  id: string;
  json?: boolean;
};

export type WorkClaimOptions = {
  id: string;
  assignee?: string;
  json?: boolean;
};

export type WorkCloseOptions = {
  id: string;
  reason?: string;
  json?: boolean;
};

export type WorkDepOptions = {
  id: string;
  blocks?: string;
  discoveredFrom?: string;
  related?: string;
  parentOf?: string;
  json?: boolean;
};

export type WorkStartOptions = {
  id: string;
  assignee?: string;
  maxTokens?: number;
  json?: boolean;
};

export type WorkPrimeOptions = {
  maxTokens?: number;
  json?: boolean;
};

export type WorkRememberOptions = {
  text: string;
  json?: boolean;
};

const WORK_TYPES: WorkType[] = ['task', 'bug', 'feature', 'epic', 'chore'];
const WORK_STATUSES: WorkStatus[] = [
  'open',
  'in_progress',
  'blocked',
  'closed',
];

function workDir(projectRoot: string): string {
  return join(projectRoot, '.code-kg', 'work');
}

function itemsPath(projectRoot: string): string {
  return join(workDir(projectRoot), 'items.jsonl');
}

function memoriesPath(projectRoot: string): string {
  return join(workDir(projectRoot), 'memories.jsonl');
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${randomBytes(2).toString('hex')}`;
}

function memoryHashId(text: string): string {
  return `mem-${createHash('sha1').update(text).digest('hex').slice(0, 8)}`;
}

async function writeTextAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function readJsonl<T>(path: string): Promise<T[]> {
  try {
    const raw = await readFile(path, 'utf8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function writeJsonl<T>(path: string, rows: T[]): Promise<void> {
  const body =
    rows.length === 0
      ? ''
      : `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
  await writeTextAtomic(path, body);
}

export async function ensureWorkStore(projectRoot: string): Promise<void> {
  await mkdir(workDir(projectRoot), { recursive: true });
  if (!existsSync(itemsPath(projectRoot))) {
    await writeTextAtomic(itemsPath(projectRoot), '');
  }
  if (!existsSync(memoriesPath(projectRoot))) {
    await writeTextAtomic(memoriesPath(projectRoot), '');
  }
}

async function loadItems(projectRoot: string): Promise<WorkItem[]> {
  await ensureWorkStore(projectRoot);
  return readJsonl<WorkItem>(itemsPath(projectRoot));
}

async function saveItems(
  projectRoot: string,
  items: WorkItem[],
): Promise<void> {
  await writeJsonl(itemsPath(projectRoot), items);
}

async function loadMemories(projectRoot: string): Promise<WorkMemory[]> {
  await ensureWorkStore(projectRoot);
  return readJsonl<WorkMemory>(memoriesPath(projectRoot));
}

async function saveMemories(
  projectRoot: string,
  memories: WorkMemory[],
): Promise<void> {
  await writeJsonl(memoriesPath(projectRoot), memories);
}

function findItem(items: WorkItem[], id: string): WorkItem | undefined {
  const exact = items.find((item) => item.id === id);
  if (exact) return exact;
  const matches = items.filter(
    (item) => item.id.endsWith(id) || item.id.startsWith(id),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function openBlockers(item: WorkItem, items: WorkItem[]): WorkItem[] {
  const byId = new Map(items.map((entry) => [entry.id, entry]));
  const blockers: WorkItem[] = [];
  for (const dep of item.deps) {
    if (dep.kind !== 'blocks') continue;
    const blocker = byId.get(dep.id);
    if (blocker && blocker.status !== 'closed') blockers.push(blocker);
  }
  return blockers;
}

export function readyItems(items: WorkItem[]): WorkItem[] {
  return items
    .filter((item) => item.status === 'open')
    .filter((item) => openBlockers(item, items).length === 0)
    .sort(
      (a, b) =>
        a.priority - b.priority || a.created_at.localeCompare(b.created_at),
    );
}

function formatItem(item: WorkItem, items: WorkItem[]): string {
  const blockers = openBlockers(item, items).map((entry) => entry.id);
  const lines = [
    `## ${item.id} — ${item.title}`,
    '',
    `- status: ${item.status}`,
    `- type: ${item.type}`,
    `- priority: P${item.priority}`,
  ];
  if (item.assignee) lines.push(`- assignee: ${item.assignee}`);
  if (item.parent) lines.push(`- parent: ${item.parent}`);
  if (item.deps.length) {
    lines.push(
      `- deps: ${item.deps.map((dep) => `${dep.kind}:${dep.id}`).join(', ')}`,
    );
  }
  if (blockers.length) lines.push(`- open blockers: ${blockers.join(', ')}`);
  if (item.queries.length) {
    lines.push(
      `- queries: ${item.queries.map((query) => JSON.stringify(query)).join(', ')}`,
    );
  }
  if (item.section_ids.length) {
    lines.push(`- sections: ${item.section_ids.join(', ')}`);
  }
  if (item.source_paths.length) {
    lines.push(`- sources: ${item.source_paths.join(', ')}`);
  }
  if (item.description) lines.push('', item.description);
  if (item.context_cache) {
    lines.push('', '### Cached knowledge context', '', item.context_cache);
  }
  if (item.close_reason) lines.push('', `Close reason: ${item.close_reason}`);
  return lines.join('\n');
}

function formatItemList(
  title: string,
  items: WorkItem[],
  all: WorkItem[],
): string {
  if (!items.length) return `# ${title}\n\nNo matching work items.`;
  return [
    `# ${title}`,
    '',
    ...items.map((item) => {
      const blockers = openBlockers(item, all);
      const blockerNote = blockers.length
        ? ` (blocked by ${blockers.map((entry) => entry.id).join(', ')})`
        : '';
      return `- ${item.id} [P${item.priority}/${item.status}/${item.type}] ${item.title}${blockerNote}`;
    }),
  ].join('\n');
}

function parseType(value: string | undefined, fallback: WorkType): WorkType {
  if (!value) return fallback;
  if (!WORK_TYPES.includes(value as WorkType)) {
    throw new Error(
      `Unknown work type "${value}". Use: ${WORK_TYPES.join(', ')}`,
    );
  }
  return value as WorkType;
}

function parseStatus(value: string): WorkStatus {
  if (!WORK_STATUSES.includes(value as WorkStatus)) {
    throw new Error(
      `Unknown work status "${value}". Use: ${WORK_STATUSES.join(', ')}`,
    );
  }
  return value as WorkStatus;
}

function parsePriority(value: number | undefined, fallback = 2): number {
  const priority = value ?? fallback;
  if (!Number.isInteger(priority) || priority < 0 || priority > 4) {
    throw new Error('Priority must be an integer from 0 (highest) to 4.');
  }
  return priority;
}

function jsonResult(value: unknown): CmdResult {
  return { output: JSON.stringify(value, null, 2) };
}

function errorResult(message: string): CmdResult {
  return { output: `# Code-KG Work\n\n${message}`, isError: true };
}

export async function workInitCommand(ctx: CmdContext): Promise<CmdResult> {
  await ensureWorkStore(ctx.projectRoot);
  return {
    output: [
      '# Code-KG Work',
      '',
      'Initialized agent work tracker at `.code-kg/work/`.',
      '',
      'Next:',
      '- `code-kg work create "First task"`',
      '- `code-kg work ready`',
      '- `code-kg work prime`',
    ].join('\n'),
  };
}

export async function workCreateCommand(
  ctx: CmdContext,
  opts: WorkCreateOptions,
): Promise<CmdResult> {
  const title = opts.title.trim();
  if (!title) return errorResult('Title is required.');

  let type: WorkType;
  let priority: number;
  try {
    type = parseType(opts.type, 'task');
    priority = parsePriority(opts.priority, 2);
  } catch (error) {
    return errorResult((error as Error).message);
  }

  const items = await loadItems(ctx.projectRoot);
  const id = newId('ck');
  const deps: WorkDep[] = [];

  for (const depId of opts.deps ?? []) {
    const target = findItem(items, depId);
    if (!target) return errorResult(`Unknown dependency id: ${depId}`);
    deps.push({ id: target.id, kind: 'blocks' });
  }

  if (opts.discoveredFrom) {
    const source = findItem(items, opts.discoveredFrom);
    if (!source) {
      return errorResult(`Unknown discovered-from id: ${opts.discoveredFrom}`);
    }
    deps.push({ id: source.id, kind: 'discovered-from' });
  }

  let parent: string | undefined;
  if (opts.parent) {
    const parentItem = findItem(items, opts.parent);
    if (!parentItem) return errorResult(`Unknown parent id: ${opts.parent}`);
    parent = parentItem.id;
  }

  const item: WorkItem = {
    id,
    title,
    description: (opts.description ?? '').trim(),
    type,
    status: 'open',
    priority,
    parent,
    deps,
    queries: [...(opts.queries ?? [])]
      .map((query) => query.trim())
      .filter(Boolean),
    section_ids: [...(opts.sectionIds ?? [])]
      .map((section) => section.trim())
      .filter(Boolean),
    source_paths: [...(opts.sourcePaths ?? [])]
      .map((path) => path.trim())
      .filter(Boolean),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  items.push(item);
  await saveItems(ctx.projectRoot, items);

  if (opts.json) return jsonResult(item);
  return {
    output: [
      '# Code-KG Work',
      '',
      `Created ${item.id}`,
      '',
      formatItem(item, items),
      '',
      'Start with knowledge context:',
      `- code-kg work start ${item.id}`,
    ].join('\n'),
  };
}

export async function workListCommand(
  ctx: CmdContext,
  opts: WorkListOptions = {},
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  let filtered = items;
  if (opts.status && opts.status !== 'all') {
    try {
      const status = parseStatus(opts.status);
      filtered = items.filter((item) => item.status === status);
    } catch (error) {
      return errorResult((error as Error).message);
    }
  }
  const sorted = [...filtered].sort(
    (a, b) =>
      Number(a.status === 'closed') - Number(b.status === 'closed') ||
      a.priority - b.priority ||
      a.created_at.localeCompare(b.created_at),
  );
  if (opts.json) return jsonResult(sorted);
  return { output: formatItemList('Code-KG Work', sorted, items) };
}

export async function workReadyCommand(
  ctx: CmdContext,
  opts: { json?: boolean } = {},
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const ready = readyItems(items);
  if (opts.json) return jsonResult(ready);
  return {
    output: [
      formatItemList('Code-KG Ready Work', ready, items),
      '',
      'Claim with `code-kg work claim <id>`, or start with knowledge priming via `code-kg work start <id>`.',
    ].join('\n'),
  };
}

export async function workShowCommand(
  ctx: CmdContext,
  opts: WorkIdOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (opts.json) return jsonResult(item);
  return { output: ['# Code-KG Work', '', formatItem(item, items)].join('\n') };
}

export async function workClaimCommand(
  ctx: CmdContext,
  opts: WorkClaimOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (item.status === 'closed') {
    return errorResult(
      `${item.id} is closed; reopen with work update --status open.`,
    );
  }
  const blockers = openBlockers(item, items);
  if (blockers.length) {
    return errorResult(
      `${item.id} is blocked by ${blockers.map((entry) => entry.id).join(', ')}.`,
    );
  }
  item.status = 'in_progress';
  item.assignee = opts.assignee?.trim() || item.assignee || 'agent';
  item.updated_at = nowIso();
  await saveItems(ctx.projectRoot, items);
  if (opts.json) return jsonResult(item);
  return {
    output: [
      '# Code-KG Work',
      '',
      `Claimed ${item.id}`,
      '',
      formatItem(item, items),
      '',
      'Orient with the knowledge graph before broad source search:',
      `- code-kg work start ${item.id}`,
      `- code-kg ask ${JSON.stringify(item.title)}`,
    ].join('\n'),
  };
}

export async function workUpdateCommand(
  ctx: CmdContext,
  opts: WorkUpdateOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);

  try {
    if (opts.title !== undefined) {
      const title = opts.title.trim();
      if (!title) throw new Error('Title cannot be empty.');
      item.title = title;
    }
    if (opts.description !== undefined) {
      item.description = opts.description.trim();
    }
    if (opts.type !== undefined) item.type = parseType(opts.type, item.type);
    if (opts.priority !== undefined) {
      item.priority = parsePriority(opts.priority, item.priority);
    }
    if (opts.status !== undefined) {
      item.status = parseStatus(opts.status);
      if (item.status !== 'closed') {
        delete item.closed_at;
        delete item.close_reason;
      }
    }
  } catch (error) {
    return errorResult((error as Error).message);
  }

  if (opts.assignee !== undefined) {
    const assignee = opts.assignee.trim();
    if (assignee) item.assignee = assignee;
    else delete item.assignee;
  }
  for (const query of opts.addQuery ?? []) {
    const trimmed = query.trim();
    if (trimmed && !item.queries.includes(trimmed)) item.queries.push(trimmed);
  }
  for (const section of opts.addSection ?? []) {
    const trimmed = section.trim();
    if (trimmed && !item.section_ids.includes(trimmed)) {
      item.section_ids.push(trimmed);
    }
  }
  for (const source of opts.addSource ?? []) {
    const trimmed = source.trim();
    if (trimmed && !item.source_paths.includes(trimmed)) {
      item.source_paths.push(trimmed);
    }
  }

  item.updated_at = nowIso();
  await saveItems(ctx.projectRoot, items);
  if (opts.json) return jsonResult(item);
  return {
    output: [
      '# Code-KG Work',
      '',
      `Updated ${item.id}`,
      '',
      formatItem(item, items),
    ].join('\n'),
  };
}

export async function workCloseCommand(
  ctx: CmdContext,
  opts: WorkCloseOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  item.status = 'closed';
  item.closed_at = nowIso();
  item.updated_at = item.closed_at;
  if (opts.reason?.trim()) item.close_reason = opts.reason.trim();
  await saveItems(ctx.projectRoot, items);
  if (opts.json) return jsonResult(item);
  return {
    output: [
      '# Code-KG Work',
      '',
      `Closed ${item.id}`,
      '',
      formatItem(item, items),
      '',
      'After closing implementation work, run `code-kg check` and `code-kg drift`.',
    ].join('\n'),
  };
}

export async function workDepCommand(
  ctx: CmdContext,
  opts: WorkDepOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);

  const links: WorkDep[] = [];
  if (opts.blocks) links.push({ id: opts.blocks, kind: 'blocks' });
  if (opts.discoveredFrom) {
    links.push({ id: opts.discoveredFrom, kind: 'discovered-from' });
  }
  if (opts.related) links.push({ id: opts.related, kind: 'related' });
  if (opts.parentOf) links.push({ id: opts.parentOf, kind: 'parent-of' });
  if (!links.length) {
    return errorResult(
      'Provide one of --blocks, --discovered-from, --related, or --parent-of.',
    );
  }

  for (const link of links) {
    const target = findItem(items, link.id);
    if (!target) return errorResult(`Unknown dependency id: ${link.id}`);
    if (target.id === item.id) {
      return errorResult('A work item cannot depend on itself.');
    }
    if (
      !item.deps.some((dep) => dep.id === target.id && dep.kind === link.kind)
    ) {
      item.deps.push({ id: target.id, kind: link.kind });
    }
  }

  item.updated_at = nowIso();
  await saveItems(ctx.projectRoot, items);
  if (opts.json) return jsonResult(item);
  return {
    output: [
      '# Code-KG Work',
      '',
      `Updated deps for ${item.id}`,
      '',
      formatItem(item, items),
    ].join('\n'),
  };
}

async function knowledgeContextForItem(
  ctx: CmdContext,
  item: WorkItem,
  maxTokens: number,
): Promise<{ text: string; usedGraph: boolean }> {
  const hasManifest = existsSync(
    join(ctx.projectRoot, '.code-kg', 'materialization-manifest.json'),
  );
  if (!hasManifest) {
    return {
      usedGraph: false,
      text: [
        'No materialization manifest yet. Run `code-kg bootstrap --accept` before relying on knowledge priming.',
        `Fallback orientation query: ${item.title}`,
      ].join('\n'),
    };
  }

  const queries = [
    ...item.queries,
    item.title,
    item.description,
    ...item.source_paths.map((path) => `context for ${path}`),
    ...item.section_ids.map((section) => `section ${section}`),
  ]
    .map((query) => query.trim())
    .filter(Boolean);

  const uniqueQueries = [...new Set(queries)].slice(0, 3);
  const chunks: string[] = [];
  for (const query of uniqueQueries) {
    try {
      const result = await askCommand(ctx, query, {
        limit: 3,
        maxTokens: Math.max(200, Math.floor(maxTokens / uniqueQueries.length)),
        source: true,
        semantic: false,
      });
      if (!result.output.includes('No matching knowledge or source found.')) {
        chunks.push(`### Ask: ${query}`, '', result.output);
      }
    } catch (error) {
      chunks.push(
        `### Ask: ${query}`,
        '',
        `Knowledge lookup failed: ${(error as Error).message}`,
      );
    }
  }

  if (!chunks.length) {
    return {
      usedGraph: true,
      text: `No knowledge/source hits for ${JSON.stringify(item.title)}. Try \`code-kg map\` or refine work queries.`,
    };
  }
  return { usedGraph: true, text: chunks.join('\n\n') };
}

export async function workStartCommand(
  ctx: CmdContext,
  opts: WorkStartOptions,
): Promise<CmdResult> {
  const claim = await workClaimCommand(ctx, {
    id: opts.id,
    assignee: opts.assignee,
    json: true,
  });
  if (claim.isError) return claim;

  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);

  const knowledge = await knowledgeContextForItem(
    ctx,
    item,
    opts.maxTokens ?? 900,
  );
  item.context_cache = knowledge.text;
  item.updated_at = nowIso();
  await saveItems(ctx.projectRoot, items);

  if (opts.json) {
    return jsonResult({
      item,
      knowledge: knowledge.text,
      usedGraph: knowledge.usedGraph,
    });
  }

  return {
    output: [
      '# Code-KG Work Start',
      '',
      formatItem(item, items),
      '',
      '## Knowledge priming',
      '',
      knowledge.text,
      '',
      '## Agent protocol',
      '',
      '- Do not broad-grep the repo next. Use the primed hits, then `code-kg section`, `code-kg impact`, or `code-kg ask` for follow-ups.',
      `- If you discover more work, create it with \`code-kg work create "..." --discovered-from ${item.id}\`.`,
      `- When finished: \`code-kg work close ${item.id} --reason "..."\`, then \`code-kg check\` and \`code-kg drift\`.`,
    ].join('\n'),
  };
}

export async function workPrimeCommand(
  ctx: CmdContext,
  opts: WorkPrimeOptions = {},
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const memories = await loadMemories(ctx.projectRoot);
  const ready = readyItems(items);
  const inProgress = items.filter((item) => item.status === 'in_progress');
  const maxTokens = opts.maxTokens ?? 700;

  const lines = [
    '# Code-KG Work Prime',
    '',
    'Use this tracker instead of markdown TODOs for multi-step agent work.',
    '',
    '## Workflow',
    '',
    '1. `code-kg work ready` — pick unblocked work',
    '2. `code-kg work start <id>` — claim + prime from the knowledge graph',
    '3. Prefer `code-kg ask` / `search` / `impact` over raw grep while executing',
    '4. `code-kg work create "discovered issue" --discovered-from <id>` for new work',
    '5. `code-kg work close <id>` then `code-kg check` + `code-kg drift`',
    '',
    '## In progress',
    '',
  ];

  if (!inProgress.length) lines.push('- None');
  else {
    for (const item of inProgress.slice(0, 5)) {
      lines.push(`- ${item.id} [P${item.priority}] ${item.title}`);
    }
  }

  lines.push('', '## Ready', '');
  if (!ready.length) lines.push('- None');
  else {
    for (const item of ready.slice(0, 8)) {
      lines.push(`- ${item.id} [P${item.priority}/${item.type}] ${item.title}`);
    }
  }

  lines.push('', '## Memories', '');
  if (!memories.length) lines.push('- None');
  else {
    for (const memory of memories.slice(-8)) {
      lines.push(`- ${memory.id}: ${memory.text}`);
    }
  }

  const focus = inProgress[0] ?? ready[0];
  if (focus) {
    const knowledge = await knowledgeContextForItem(ctx, focus, maxTokens);
    lines.push('', `## Focus context (${focus.id})`, '', knowledge.text);
  } else {
    lines.push(
      '',
      '## Focus context',
      '',
      'No open or in-progress work. Create an item with `code-kg work create "<title>"`.',
    );
  }

  if (opts.json) {
    return jsonResult({
      ready,
      in_progress: inProgress,
      memories,
      focus: focus ?? null,
      output: lines.join('\n'),
    });
  }
  return { output: lines.join('\n') };
}

export async function workRememberCommand(
  ctx: CmdContext,
  opts: WorkRememberOptions,
): Promise<CmdResult> {
  const text = opts.text.trim();
  if (!text) return errorResult('Memory text is required.');
  const memories = await loadMemories(ctx.projectRoot);
  const id = memoryHashId(text);
  const existing = memories.find((memory) => memory.id === id);
  if (existing) {
    if (opts.json) return jsonResult(existing);
    return {
      output: [
        '# Code-KG Work',
        '',
        `Memory already present: ${existing.id}`,
        '',
        existing.text,
      ].join('\n'),
    };
  }
  const memory: WorkMemory = { id, text, created_at: nowIso() };
  memories.push(memory);
  await saveMemories(ctx.projectRoot, memories);
  if (opts.json) return jsonResult(memory);
  return {
    output: [
      '# Code-KG Work',
      '',
      `Remembered ${memory.id}`,
      '',
      memory.text,
      '',
      'Included automatically by `code-kg work prime`.',
    ].join('\n'),
  };
}

export async function workMemoriesCommand(
  ctx: CmdContext,
  opts: { json?: boolean } = {},
): Promise<CmdResult> {
  const memories = await loadMemories(ctx.projectRoot);
  if (opts.json) return jsonResult(memories);
  if (!memories.length) {
    return { output: '# Code-KG Work Memories\n\nNo memories stored.' };
  }
  return {
    output: [
      '# Code-KG Work Memories',
      '',
      ...memories.map((memory) => `- ${memory.id}: ${memory.text}`),
    ].join('\n'),
  };
}

/** Compact summary for SessionStart hooks. */
export async function workSessionSummary(
  projectRoot: string,
): Promise<string | null> {
  if (!existsSync(itemsPath(projectRoot))) return null;
  const items = await loadItems(projectRoot);
  if (!items.length) return null;
  const ready = readyItems(items);
  const inProgress = items.filter((item) => item.status === 'in_progress');
  if (!ready.length && !inProgress.length) return null;
  return [
    'Code-KG work tracker:',
    ...inProgress
      .slice(0, 3)
      .map((item) => `- in_progress ${item.id}: ${item.title}`),
    ...ready.slice(0, 5).map((item) => `- ready ${item.id}: ${item.title}`),
    'Use `code-kg work prime` or `code-kg work start <id>` before broad source search.',
  ].join('\n');
}
