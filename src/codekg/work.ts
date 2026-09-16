import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomBytes } from 'node:crypto';
import { copyFileSync, existsSync } from 'node:fs';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import type { CmdContext, CmdResult } from '../context.js';
import { askCommand } from './query.js';
import {
  canonicalProjectRoot,
  inspectWorktreeForAdoption,
  type WorktreeAdoption,
  createIsolatedWorktree,
  evidenceDir,
  listOpenPrOverlaps,
  removeIsolatedWorktree,
  stableEvidenceName,
} from './worktree.js';

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

export type WorkEvidenceKind =
  | 'before'
  | 'after'
  | 'pair'
  | 'recording'
  | 'note';

export type WorkEvidence = {
  id: string;
  kind: WorkEvidenceKind;
  label: string;
  path: string;
  paired_with?: string;
  created_at: string;
  notes?: string;
};

/** Reticle-style runtime / check verdict for "is it actually done?" */
export type WorkVerdict = 'pass' | 'fail' | 'inconclusive';

export type WorkCheckResult = {
  name: string;
  verdict: WorkVerdict;
  detail?: string;
};

export type WorkVerification = {
  id: string;
  verdict: WorkVerdict;
  summary: string;
  method?: string;
  checks: WorkCheckResult[];
  evidence_ids: string[];
  created_at: string;
  actor?: string;
  role?: WorkAuthority['role'];
  sealed_revision?: string;
};

export type WorkInterviewQuestion = {
  id: string;
  prompt: string;
  answer?: string;
  answered_at?: string;
};

/** Ouroboros-style interview → assumptions → acceptance before build. */
export type WorkInterview = {
  questions: WorkInterviewQuestion[];
  generated_at: string;
  sealed_at?: string;
  revision?: string;
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
  worktree_path?: string;
  worktree_branch?: string;
  worktree_adoption?: WorktreeAdoption;
  closed_by?: string;
  seal_override_by?: string;
  close_override_by?: string;
  evidence: WorkEvidence[];
  assumptions: string[];
  acceptance: string[];
  interview?: WorkInterview;
  verifications: WorkVerification[];
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
  assumptions?: string[];
  acceptance?: string[];
  interview?: boolean;
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
  force?: boolean;
  allowInconclusive?: boolean;
  json?: boolean;
};

export type WorkVerifyOptions = {
  id: string;
  verdict: string;
  summary: string;
  method?: string;
  check?: string[];
  evidenceId?: string[];
  json?: boolean;
};

export type WorkInterviewOptions = {
  id: string;
  refresh?: boolean;
  json?: boolean;
};

export type WorkAnswerOptions = {
  id: string;
  question: string;
  answer: string;
  json?: boolean;
};

export type WorkAssumeOptions = {
  id: string;
  text: string;
  json?: boolean;
};

export type WorkAcceptOptions = {
  id: string;
  criterion: string;
  json?: boolean;
};

export type WorkSealOptions = {
  id: string;
  force?: boolean;
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
  worktree?: boolean;
  forceScope?: boolean;
  json?: boolean;
};

export type WorkIsolateOptions = {
  id: string;
  forceScope?: boolean;
  json?: boolean;
};

export type WorkCleanupOptions = {
  id: string;
  force?: boolean;
  json?: boolean;
};

export type WorkEvidenceAttachOptions = {
  id: string;
  kind: WorkEvidenceKind;
  path: string;
  label?: string;
  pairedWith?: string;
  notes?: string;
  json?: boolean;
};

export type WorkEvidencePairOptions = {
  id: string;
  before: string;
  after: string;
  label?: string;
  notes?: string;
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
  return join(canonicalProjectRoot(projectRoot), '.code-kg', 'work');
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
    const raw =
      transactionContext.getStore()?.pending.get(path) ??
      (await readFile(path, 'utf8'));
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
  const transaction = transactionContext.getStore();
  if (transaction) transaction.pending.set(path, body);
  else await writeTextAtomic(path, body);
}

export async function ensureWorkStore(projectRoot: string): Promise<void> {
  const canonical = workDir(projectRoot);
  const local = join(resolve(projectRoot), '.code-kg', 'work');
  if (canonical !== local) {
    for (const name of ['items.jsonl', 'memories.jsonl']) {
      try {
        if ((await readFile(join(local, name), 'utf8')).trim())
          throw new Error(
            `Independent worktree work store found at ${local}; explicit reconciliation is required before using the shared store.`,
          );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }
  await mkdir(canonical, { recursive: true });
  for (const path of [itemsPath(projectRoot), memoriesPath(projectRoot)]) {
    try {
      await (await open(path, 'wx')).close();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
}

async function loadItems(projectRoot: string): Promise<WorkItem[]> {
  await ensureWorkStore(projectRoot);
  const items = await readJsonl<WorkItem>(itemsPath(projectRoot));
  for (const item of items) {
    item.evidence ??= [];
    item.deps ??= [];
    item.queries ??= [];
    item.section_ids ??= [];
    item.source_paths ??= [];
    item.assumptions ??= [];
    item.acceptance ??= [];
    item.verifications ??= [];
    if (item.worktree_path && !isAbsolute(item.worktree_path))
      item.worktree_path = resolve(
        canonicalProjectRoot(projectRoot),
        item.worktree_path,
      );
    for (const evidence of item.evidence) {
      if (evidence.kind !== 'pair' && !isAbsolute(evidence.path))
        evidence.path = resolve(
          canonicalProjectRoot(projectRoot),
          evidence.path,
        );
    }
  }
  return items;
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
  if (item.worktree_path) {
    lines.push(
      `- worktree: ${item.worktree_path} (${item.worktree_branch ?? 'branch?'})`,
    );
  }
  if (item.evidence?.length) {
    lines.push(
      `- evidence: ${item.evidence
        .map((entry) => `${entry.kind}:${entry.label}`)
        .join(', ')}`,
    );
  }
  if (item.assumptions?.length) {
    lines.push(
      `- assumptions: ${item.assumptions.map((text) => JSON.stringify(text)).join('; ')}`,
    );
  }
  if (item.acceptance?.length) {
    lines.push(
      `- acceptance: ${item.acceptance.map((text) => JSON.stringify(text)).join('; ')}`,
    );
  }
  if (item.interview) {
    const answered = item.interview.questions.filter((q) => q.answer).length;
    const total = item.interview.questions.length;
    lines.push(
      `- interview: ${answered}/${total} answered${item.interview.sealed_at ? ' (sealed)' : ''}`,
    );
  }
  const latest = latestVerification(item);
  if (latest) {
    lines.push(
      `- verification: ${latest.verdict} — ${latest.summary}${latest.method ? ` [${latest.method}]` : ''}`,
    );
  }
  if (item.description) lines.push('', item.description);
  if (item.context_cache) {
    lines.push('', '### Cached knowledge context', '', item.context_cache);
  }
  if (item.close_reason) lines.push('', `Close reason: ${item.close_reason}`);
  return lines.join('\n');
}

function latestVerification(item: WorkItem): WorkVerification | undefined {
  if (!item.verifications?.length) return undefined;
  return [...item.verifications].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )[item.verifications.length - 1];
}

function parseVerdict(value: string): WorkVerdict {
  const normalized = value.trim().toLowerCase();
  if (
    normalized !== 'pass' &&
    normalized !== 'fail' &&
    normalized !== 'inconclusive'
  ) {
    throw new Error('Verdict must be pass, fail, or inconclusive.');
  }
  return normalized;
}

function parseCheckFlag(raw: string): WorkCheckResult {
  const trimmed = raw.trim();
  const colon = trimmed.lastIndexOf(':');
  if (colon <= 0) {
    throw new Error(
      `Invalid --check "${raw}". Use name:pass|fail|inconclusive.`,
    );
  }
  const name = trimmed.slice(0, colon).trim();
  const verdict = parseVerdict(trimmed.slice(colon + 1));
  if (!name) throw new Error(`Invalid --check "${raw}". Name is required.`);
  return { name, verdict };
}

function generateInterviewQuestions(item: WorkItem): WorkInterviewQuestion[] {
  const prompts: string[] = [];
  const blob = `${item.title}\n${item.description}`.toLowerCase();
  if (!item.description.trim()) {
    prompts.push('What is the concrete, user-visible outcome of this work?');
  }
  if (!item.acceptance.length) {
    prompts.push(
      'What observable check proves this is done (command, UI flow, or assertion)?',
    );
  }
  if (!item.source_paths.length) {
    prompts.push('Which files or modules are in scope for this change?');
  }
  if (
    /\b(improve|better|fix|somehow|properly|clean up|refactor)\b/.test(blob)
  ) {
    prompts.push(
      'What is wrong today versus what “done” looks like in measurable terms?',
    );
  }
  prompts.push('What is explicitly out of scope and must not change?');
  prompts.push(
    'How will you verify at runtime (tests, CLI, browser/app flow) after the change?',
  );
  return prompts.map((prompt, index) => ({
    id: `q${index + 1}`,
    prompt,
  }));
}

function unansweredQuestions(item: WorkItem): WorkInterviewQuestion[] {
  return (item.interview?.questions ?? []).filter(
    (question) => !question.answer,
  );
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

async function workInitCommandImpl(ctx: CmdContext): Promise<CmdResult> {
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

async function workCreateCommandImpl(
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
    evidence: [],
    assumptions: [...(opts.assumptions ?? [])]
      .map((text) => text.trim())
      .filter(Boolean),
    acceptance: [...(opts.acceptance ?? [])]
      .map((text) => text.trim())
      .filter(Boolean),
    verifications: [],
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  if (opts.interview !== false) {
    item.interview = {
      questions: generateInterviewQuestions(item),
      generated_at: nowIso(),
    };
  }
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
      item.interview
        ? [
            'Interview questions (answer before sealing):',
            ...item.interview.questions.map(
              (question) => `- ${question.id}: ${question.prompt}`,
            ),
            '',
            `Answer with: code-kg work answer ${item.id} --question <id> --answer "..."`,
            `Seal with: code-kg work seal ${item.id}`,
            '',
          ].join('\n')
        : '',
      'Start with knowledge context:',
      `- code-kg work start ${item.id}`,
    ]
      .filter(Boolean)
      .join('\n'),
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

async function workClaimCommandImpl(
  ctx: CmdContext,
  opts: WorkClaimOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (!item.interview?.sealed_at)
    return errorResult(`${item.id} must be sealed before execution.`);
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
  item.assignee =
    (ctx as WorkCommandContext).workAuthority?.role === 'worker'
      ? (ctx as WorkCommandContext).workAuthority!.actor
      : opts.assignee?.trim() || item.assignee || 'agent';
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

async function workUpdateCommandImpl(
  ctx: CmdContext,
  opts: WorkUpdateOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);

  if (opts.status === 'closed' || opts.status === 'in_progress') {
    return errorResult(
      'Use work close or work start for guarded execution transitions.',
    );
  }
  if (
    item.interview?.sealed_at &&
    (opts.title !== undefined ||
      opts.description !== undefined ||
      opts.addQuery?.length ||
      opts.addSection?.length ||
      opts.addSource?.length)
  ) {
    return errorResult(
      `${item.id} is sealed; reopen its interview before changing the contract.`,
    );
  }

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

async function workCloseCommandImpl(
  ctx: CmdContext,
  opts: WorkCloseOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);

  if (!opts.force && item.status !== 'in_progress')
    return errorResult('Start or claim work before closing it.');
  if (!opts.force && !item.interview?.sealed_at)
    return errorResult('Seal work before closing it.');
  if (!opts.force) {
    const latest = latestVerification(item);
    if (!latest) {
      return errorResult(
        [
          `${item.id} has no verification yet. Record a Reticle-style runtime check before closing:`,
          `  code-kg work verify ${item.id} --verdict pass --summary "..." --method runtime`,
          'Or close with --force to bypass (not recommended).',
        ].join('\n'),
      );
    }
    if (
      item.interview?.revision &&
      latest.sealed_revision !== item.interview.revision
    )
      return errorResult(
        'Verification belongs to a different sealed revision.',
      );
    if (latest.verdict === 'fail') {
      return errorResult(
        [
          `${item.id} latest verification is fail: ${latest.summary}`,
          'Fix the failure, re-verify with pass, or close with --force.',
        ].join('\n'),
      );
    }
    if (latest.verdict === 'inconclusive' && !opts.allowInconclusive) {
      return errorResult(
        [
          `${item.id} latest verification is inconclusive: ${latest.summary}`,
          'Re-verify to pass, or close with --allow-inconclusive / --force.',
        ].join('\n'),
      );
    }
  }

  item.status = 'closed';
  item.closed_by =
    (ctx as WorkCommandContext).workAuthority?.actor ?? 'local-operator';
  if (opts.force || opts.allowInconclusive)
    item.close_override_by = item.closed_by;
  item.closed_at = nowIso();
  item.updated_at = item.closed_at;
  if (opts.reason?.trim()) item.close_reason = opts.reason.trim();
  await saveItems(ctx.projectRoot, items);
  if (opts.json) return jsonResult(item);

  const latest = latestVerification(item);
  const warnings: string[] = [];
  if (
    !item.evidence.some(
      (entry) => entry.kind === 'pair' || entry.kind === 'after',
    )
  ) {
    warnings.push(
      '- No before/after evidence attached; consider `work evidence pair` next time.',
    );
  }
  if (item.acceptance.length && latest) {
    const covered = new Set(latest.checks.map((check) => check.name));
    const missing = item.acceptance.filter(
      (criterion) =>
        ![...covered].some(
          (name) =>
            criterion.includes(name) || name.includes(criterion.slice(0, 24)),
        ),
    );
    if (missing.length) {
      warnings.push(
        `- Acceptance criteria without matching verify checks: ${missing.map((text) => JSON.stringify(text)).join('; ')}`,
      );
    }
  }

  return {
    output: [
      '# Code-KG Work',
      '',
      `Closed ${item.id}`,
      '',
      formatItem(item, items),
      '',
      latest
        ? `Close gate: verification ${latest.verdict}${opts.force ? ' (forced)' : ''}.`
        : 'Close gate: bypassed with --force (no verification).',
      ...warnings,
      '',
      'After closing implementation work, run `code-kg check` and `code-kg drift`.',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

async function workVerifyCommandImpl(
  ctx: CmdContext,
  opts: WorkVerifyOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (item.status !== 'in_progress')
    return errorResult('Start or claim work before recording verification.');
  const summary = opts.summary.trim();
  if (!summary) return errorResult('Verification --summary is required.');

  let verdict: WorkVerdict;
  let checks: WorkCheckResult[];
  try {
    verdict = parseVerdict(opts.verdict);
    checks = (opts.check ?? []).map(parseCheckFlag);
  } catch (error) {
    return errorResult((error as Error).message);
  }

  const evidenceIds: string[] = [];
  for (const evidenceId of opts.evidenceId ?? []) {
    const match = item.evidence.find(
      (entry) =>
        entry.id === evidenceId ||
        entry.id.endsWith(evidenceId) ||
        entry.id.startsWith(evidenceId),
    );
    if (!match) return errorResult(`Unknown evidence id: ${evidenceId}`);
    evidenceIds.push(match.id);
  }

  // If checks disagree, overall verdict cannot be stronger than the worst check.
  if (checks.length) {
    if (checks.some((check) => check.verdict === 'fail')) verdict = 'fail';
    else if (
      checks.some((check) => check.verdict === 'inconclusive') &&
      verdict === 'pass'
    ) {
      verdict = 'inconclusive';
    }
  }

  const verification: WorkVerification = {
    id: `vf-${randomBytes(2).toString('hex')}`,
    verdict,
    summary,
    method: opts.method?.trim() || 'manual',
    checks,
    evidence_ids: evidenceIds,
    created_at: nowIso(),
    actor: (ctx as WorkCommandContext).workAuthority?.actor,
    role: (ctx as WorkCommandContext).workAuthority?.role,
    sealed_revision: item.interview?.revision,
  };
  item.verifications.push(verification);
  item.updated_at = nowIso();
  await saveItems(ctx.projectRoot, items);
  if (opts.json) return jsonResult({ item, verification });
  return {
    output: [
      '# Code-KG Work Verify',
      '',
      `Recorded ${verification.verdict} for ${item.id}`,
      `- id: ${verification.id}`,
      `- method: ${verification.method}`,
      `- summary: ${verification.summary}`,
      checks.length
        ? `- checks: ${checks.map((check) => `${check.name}:${check.verdict}`).join(', ')}`
        : undefined,
      evidenceIds.length ? `- evidence: ${evidenceIds.join(', ')}` : undefined,
      '',
      verdict === 'pass'
        ? `Close with: code-kg work close ${item.id} --reason "..."`
        : verdict === 'inconclusive'
          ? `Close requires --allow-inconclusive, or re-verify to pass.`
          : 'Fix failures and re-run work verify before closing.',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

async function workInterviewCommandImpl(
  ctx: CmdContext,
  opts: WorkInterviewOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);

  if (!item.interview || opts.refresh) {
    if (opts.refresh && item.status !== 'open')
      return errorResult(
        'Reopen work to open status before refreshing its interview.',
      );
    const priorAnswers = new Map(
      (item.interview?.questions ?? [])
        .filter((question) => question.answer)
        .map((question) => [question.prompt, question] as const),
    );
    const questions = generateInterviewQuestions(item).map((question) => {
      const prior = priorAnswers.get(question.prompt);
      return prior
        ? {
            ...question,
            answer: prior.answer,
            answered_at: prior.answered_at,
          }
        : question;
    });
    item.interview = {
      questions,
      generated_at: nowIso(),
      sealed_at: undefined,
    };
    item.updated_at = nowIso();
    await saveItems(ctx.projectRoot, items);
  }

  if (opts.json) return jsonResult(item.interview);
  const unanswered = unansweredQuestions(item);
  return {
    output: [
      '# Code-KG Work Interview',
      '',
      formatItem(item, items),
      '',
      '## Questions',
      '',
      ...item.interview!.questions.map((question) =>
        question.answer
          ? `- ${question.id}: ${question.prompt}\n  answer: ${question.answer}`
          : `- ${question.id}: ${question.prompt}`,
      ),
      '',
      unanswered.length
        ? `${unanswered.length} unanswered. Use \`code-kg work answer ${item.id} --question <id> --answer "..."\`.`
        : `All answered. Seal with \`code-kg work seal ${item.id}\`.`,
    ].join('\n'),
  };
}

async function workAnswerCommandImpl(
  ctx: CmdContext,
  opts: WorkAnswerOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (!item.interview) {
    item.interview = {
      questions: generateInterviewQuestions(item),
      generated_at: nowIso(),
    };
  }
  if (item.interview.sealed_at) {
    return errorResult(
      `${item.id} interview is sealed. Refresh with \`work interview ${item.id} --refresh\` to reopen.`,
    );
  }

  const key = opts.question.trim();
  const question =
    item.interview.questions.find((entry) => entry.id === key) ??
    item.interview.questions.find((entry) =>
      entry.prompt.toLowerCase().includes(key.toLowerCase()),
    );
  if (!question) {
    return errorResult(
      `Unknown question "${opts.question}". Use q1, q2, ... from work interview.`,
    );
  }
  const answer = opts.answer.trim();
  if (!answer) return errorResult('Answer text is required.');
  question.answer = answer;
  question.answered_at = nowIso();
  item.updated_at = nowIso();
  await saveItems(ctx.projectRoot, items);
  if (opts.json) return jsonResult({ item, question });
  const remaining = unansweredQuestions(item).length;
  return {
    output: [
      '# Code-KG Work Answer',
      '',
      `Recorded answer for ${question.id} on ${item.id}`,
      '',
      remaining
        ? `${remaining} question(s) still unanswered.`
        : `All questions answered. Seal with: code-kg work seal ${item.id}`,
    ].join('\n'),
  };
}

async function workAssumeCommandImpl(
  ctx: CmdContext,
  opts: WorkAssumeOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (item.interview?.sealed_at)
    return errorResult(
      `${item.id} is sealed; reopen its interview before changing the contract.`,
    );
  const text = opts.text.trim();
  if (!text) return errorResult('Assumption text is required.');
  if (!item.assumptions.includes(text)) item.assumptions.push(text);
  item.updated_at = nowIso();
  await saveItems(ctx.projectRoot, items);
  if (opts.json) return jsonResult(item);
  return {
    output: [
      '# Code-KG Work Assume',
      '',
      `Added assumption on ${item.id}`,
      `- ${JSON.stringify(text)}`,
    ].join('\n'),
  };
}

async function workAcceptCommandImpl(
  ctx: CmdContext,
  opts: WorkAcceptOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (item.interview?.sealed_at)
    return errorResult(
      `${item.id} is sealed; reopen its interview before changing the contract.`,
    );
  const criterion = opts.criterion.trim();
  if (!criterion) return errorResult('Acceptance criterion is required.');
  if (!item.acceptance.includes(criterion)) item.acceptance.push(criterion);
  item.updated_at = nowIso();
  await saveItems(ctx.projectRoot, items);
  if (opts.json) return jsonResult(item);
  return {
    output: [
      '# Code-KG Work Accept',
      '',
      `Added acceptance criterion on ${item.id}`,
      `- ${JSON.stringify(criterion)}`,
      '',
      'Cover it later with `work verify --check "<short-name>:pass"`.',
    ].join('\n'),
  };
}

async function workSealCommandImpl(
  ctx: CmdContext,
  opts: WorkSealOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (!item.interview) {
    item.interview = {
      questions: generateInterviewQuestions(item),
      generated_at: nowIso(),
    };
  }
  const unanswered = unansweredQuestions(item);
  if (unanswered.length && !opts.force) {
    return errorResult(
      [
        `${item.id} still has ${unanswered.length} unanswered interview question(s):`,
        ...unanswered.map((question) => `- ${question.id}: ${question.prompt}`),
        'Answer them, or seal with --force.',
      ].join('\n'),
    );
  }
  if (!item.acceptance.length && !opts.force) {
    return errorResult(
      `${item.id} has no acceptance criteria. Add with \`work accept ${item.id} --criterion "..."\`, or seal with --force.`,
    );
  }
  if (item.interview.sealed_at)
    return opts.json
      ? jsonResult(item)
      : { output: `Already sealed: ${item.id}` };
  item.interview.sealed_at = nowIso();
  item.interview.revision = createHash('sha256')
    .update(
      JSON.stringify({
        title: item.title,
        description: item.description,
        acceptance: item.acceptance,
        assumptions: item.assumptions,
        deps: item.deps,
        questions: item.interview.questions,
        queries: item.queries,
        sources: item.source_paths,
        sections: item.section_ids,
        sealed_at: item.interview.sealed_at,
      }),
    )
    .digest('hex');
  if (opts.force)
    item.seal_override_by =
      (ctx as WorkCommandContext).workAuthority?.actor ?? 'local-operator';
  item.updated_at = nowIso();
  await saveItems(ctx.projectRoot, items);
  if (opts.json) return jsonResult(item);
  return {
    output: [
      '# Code-KG Work Seal',
      '',
      `Sealed interview for ${item.id}${opts.force ? ' (forced)' : ''}`,
      '',
      formatItem(item, items),
      '',
      `Ready to build: code-kg work start ${item.id}`,
    ].join('\n'),
  };
}

async function workDepCommandImpl(
  ctx: CmdContext,
  opts: WorkDepOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (item.interview?.sealed_at)
    return errorResult(
      `${item.id} is sealed; reopen its interview before changing the contract.`,
    );

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

async function workStartCommandImpl(
  ctx: CmdContext,
  opts: WorkStartOptions,
): Promise<CmdResult> {
  if (opts.worktree) {
    const isolated = await workIsolateCommand(ctx, {
      id: opts.id,
      forceScope: opts.forceScope,
      json: true,
    });
    if (isolated.isError) return isolated;
  }

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
      item.worktree_path
        ? `- Continue in the isolated worktree: \`${item.worktree_path}\` (branch \`${item.worktree_branch}\`).`
        : '- Optional isolation: `code-kg work isolate <id>` or `work start <id> --worktree`.',
      '- Prefer actions/orchestration for why/when and shared services for reusable how (see code-structure skill).',
      '- If the interview is unsealed, answer + seal before large implementation (`work interview` / `work answer` / `work seal`).',
      '- Capture before/after evidence with `code-kg work evidence pair <id> --before <path> --after <path>` before claiming done.',
      '- Record a runtime verification (`work verify <id> --verdict pass --summary "..." --method runtime`) before close.',
      '- Do not broad-grep the repo next. Use the primed hits, then `code-kg section`, `code-kg impact`, or `code-kg ask` for follow-ups.',
      `- If you discover more work, create it with \`code-kg work create "..." --discovered-from ${item.id}\`.`,
      `- When finished: \`code-kg work verify ${item.id} --verdict pass --summary "..."\` then \`code-kg work close ${item.id} --reason "..."\`, then \`code-kg check\` and \`code-kg drift\`.`,
      item.worktree_path
        ? `- After merge/close: \`code-kg work cleanup ${item.id}\`.`
        : undefined,
      item.interview && !item.interview.sealed_at
        ? `- Interview still open (${unansweredQuestions(item).length} unanswered).`
        : undefined,
      item.acceptance.length
        ? `- Acceptance criteria: ${item.acceptance.map((text) => JSON.stringify(text)).join('; ')}`
        : undefined,
    ]
      .filter(Boolean)
      .join('\n'),
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
    '2. `code-kg work interview/answer/seal <id>` — resolve ambiguity + acceptance before coding',
    '3. `code-kg work start <id>` — claim + prime from the knowledge graph',
    '4. Prefer `code-kg ask` / `search` / `impact` over raw grep while executing',
    '5. `code-kg work evidence pair` + `work verify --verdict pass` before close',
    '6. `code-kg work close <id>` then `code-kg check` + `code-kg drift`',
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

async function workRememberCommandImpl(
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
    ...inProgress.slice(0, 3).map((item) => {
      const tree = item.worktree_path ? ` @ ${item.worktree_path}` : '';
      return `- in_progress ${item.id}: ${item.title}${tree}`;
    }),
    ...ready.slice(0, 5).map((item) => `- ready ${item.id}: ${item.title}`),
    'Use `code-kg work prime` or `code-kg work start <id> --worktree` before broad source search.',
  ].join('\n');
}

async function workIsolateCommandImpl(
  ctx: CmdContext,
  opts: WorkIsolateOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (!item.interview?.sealed_at)
    return errorResult(`${item.id} must be sealed before execution.`);
  if (
    item.worktree_path &&
    existsSync(
      resolve(canonicalProjectRoot(ctx.projectRoot), item.worktree_path),
    )
  ) {
    if (item.worktree_adoption) {
      await inspectWorktreeForAdoption({
        projectRoot: ctx.projectRoot,
        path: item.worktree_path,
        branch: item.worktree_branch!,
        base: item.worktree_adoption.base,
        sessionId: item.worktree_adoption.sessionId,
      });
    }
    if (opts.json) return jsonResult(item);
    return {
      output: [
        '# Code-KG Work Isolate',
        '',
        `Already isolated at ${item.worktree_path} (${item.worktree_branch}).`,
      ].join('\n'),
    };
  }

  if (item.source_paths.length && !opts.forceScope) {
    const conflicts = await listOpenPrOverlaps({
      projectRoot: ctx.projectRoot,
      candidatePaths: item.source_paths,
    });
    if (conflicts.length) {
      return errorResult(
        [
          'Open PR overlap detected for linked source paths. Re-run with --force-scope to proceed, or pick different files.',
          ...conflicts.map(
            (conflict) =>
              `- PR #${conflict.prNumber} ${conflict.title}: ${conflict.overlappingFiles.join(', ')}`,
          ),
        ].join('\n'),
      );
    }
  }

  try {
    const tree = await createIsolatedWorktree({
      projectRoot: ctx.projectRoot,
      workId: item.id,
      title: item.title,
    });
    item.worktree_path = tree.path;
    item.worktree_branch = tree.branch;
    item.updated_at = nowIso();
    await saveItems(ctx.projectRoot, items);
    if (opts.json) return jsonResult({ item, worktree: tree });
    return {
      output: [
        '# Code-KG Work Isolate',
        '',
        `Created worktree for ${item.id}`,
        `- path: ${item.worktree_path}`,
        `- branch: ${item.worktree_branch}`,
        '',
        'Enter the worktree before editing files. Worktrees do not isolate ports, DBs, or lockfiles.',
        `Cleanup later with: code-kg work cleanup ${item.id}`,
      ].join('\n'),
    };
  } catch (error) {
    return errorResult((error as Error).message);
  }
}

async function workCleanupCommandImpl(
  ctx: CmdContext,
  opts: WorkCleanupOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (!item.worktree_path && !item.worktree_branch) {
    return errorResult(`${item.id} has no attached worktree.`);
  }
  try {
    await removeIsolatedWorktree({
      projectRoot: ctx.projectRoot,
      worktreePath: resolve(
        canonicalProjectRoot(ctx.projectRoot),
        item.worktree_path ?? '',
      ),
      branch: item.worktree_branch,
      force: opts.force,
    });
    delete item.worktree_path;
    delete item.worktree_branch;
    item.updated_at = nowIso();
    await saveItems(ctx.projectRoot, items);
    if (opts.json) return jsonResult(item);
    return {
      output: [
        '# Code-KG Work Cleanup',
        '',
        `Removed worktree/branch for ${item.id}.`,
      ].join('\n'),
    };
  } catch (error) {
    return errorResult((error as Error).message);
  }
}

async function copyEvidenceFile(
  projectRoot: string,
  workId: string,
  sourcePath: string,
  label: string,
): Promise<{ abs: string; rel: string }> {
  const absoluteSource = resolve(projectRoot, sourcePath);
  if (!existsSync(absoluteSource)) {
    throw new Error(`Evidence file not found: ${sourcePath}`);
  }
  const ext = basename(absoluteSource).includes('.')
    ? basename(absoluteSource).split('.').pop()!
    : 'bin';
  const dir = evidenceDir(projectRoot, workId);
  await mkdir(dir, { recursive: true });
  const name = stableEvidenceName(label, ext);
  const absoluteDest = join(dir, name);
  copyFileSync(absoluteSource, absoluteDest);
  return {
    abs: absoluteDest,
    rel: absoluteDest,
  };
}

async function workEvidenceAttachCommandImpl(
  ctx: CmdContext,
  opts: WorkEvidenceAttachOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  const label = (opts.label ?? opts.kind).trim();
  try {
    const copied = await copyEvidenceFile(
      ctx.projectRoot,
      item.id,
      opts.path,
      label,
    );
    const evidence: WorkEvidence = {
      id: `ev-${randomBytes(2).toString('hex')}`,
      kind: opts.kind,
      label,
      path: copied.rel,
      paired_with: opts.pairedWith,
      notes: opts.notes?.trim() || undefined,
      created_at: nowIso(),
    };
    item.evidence.push(evidence);
    item.updated_at = nowIso();
    await saveItems(ctx.projectRoot, items);
    if (opts.json) return jsonResult({ item, evidence });
    return {
      output: [
        '# Code-KG Work Evidence',
        '',
        `Attached ${evidence.kind} evidence to ${item.id}`,
        `- id: ${evidence.id}`,
        `- path: ${evidence.path}`,
        evidence.notes ? `- notes: ${evidence.notes}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  } catch (error) {
    return errorResult((error as Error).message);
  }
}

async function workEvidencePairCommandImpl(
  ctx: CmdContext,
  opts: WorkEvidencePairOptions,
): Promise<CmdResult> {
  const label = (opts.label ?? 'before-after').trim();
  const before = await workEvidenceAttachCommand(ctx, {
    id: opts.id,
    kind: 'before',
    path: opts.before,
    label: `${label}-before`,
    notes: opts.notes,
    json: true,
  });
  if (before.isError) return before;
  const beforePayload = JSON.parse(before.output) as {
    evidence: WorkEvidence;
  };
  const after = await workEvidenceAttachCommand(ctx, {
    id: opts.id,
    kind: 'after',
    path: opts.after,
    label: `${label}-after`,
    pairedWith: beforePayload.evidence.id,
    notes: opts.notes,
    json: true,
  });
  if (after.isError) return after;
  const afterPayload = JSON.parse(after.output) as {
    item: WorkItem;
    evidence: WorkEvidence;
  };

  // Link the before entry to the after entry as well.
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (item) {
    const beforeEntry = item.evidence.find(
      (entry) => entry.id === beforePayload.evidence.id,
    );
    if (beforeEntry) beforeEntry.paired_with = afterPayload.evidence.id;
    const pair: WorkEvidence = {
      id: `ev-${randomBytes(2).toString('hex')}`,
      kind: 'pair',
      label,
      path: `${beforePayload.evidence.path} → ${afterPayload.evidence.path}`,
      paired_with: afterPayload.evidence.id,
      notes: opts.notes?.trim() || undefined,
      created_at: nowIso(),
    };
    item.evidence.push(pair);
    item.updated_at = nowIso();
    await saveItems(ctx.projectRoot, items);
    if (opts.json) {
      return jsonResult({
        item,
        before: beforePayload.evidence,
        after: afterPayload.evidence,
        pair,
      });
    }
    return {
      output: [
        '# Code-KG Work Evidence Pair',
        '',
        `Recorded before/after pair for ${item.id}`,
        '',
        `| Before | After |`,
        `| --- | --- |`,
        `| \`${beforePayload.evidence.path}\` | \`${afterPayload.evidence.path}\` |`,
        '',
        'Optional: if `@vercel/before-and-after` is installed, generate a visual table with:',
        `npx @vercel/before-and-after ${beforePayload.evidence.path} ${afterPayload.evidence.path} --markdown`,
        '',
        'See the evidence / before-and-after skills for capture workflows.',
      ].join('\n'),
    };
  }
  return after;
}

export async function workEvidenceListCommand(
  ctx: CmdContext,
  opts: WorkIdOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (opts.json) return jsonResult(item.evidence);
  if (!item.evidence.length) {
    return {
      output: `# Code-KG Work Evidence\n\nNo evidence attached to ${item.id}.`,
    };
  }
  return {
    output: [
      `# Code-KG Work Evidence (${item.id})`,
      '',
      ...item.evidence.map(
        (entry) =>
          `- ${entry.id} [${entry.kind}] ${entry.label} → ${entry.path}${
            entry.paired_with ? ` (paired ${entry.paired_with})` : ''
          }`,
      ),
    ].join('\n'),
  };
}

export type WorkAuthority = {
  actor: string;
  role: 'worker' | 'reviewer' | 'operator';
  workId?: string;
  sealedRevision?: string;
};
/** Supply only from a trusted host/broker, never MCP arguments or model-set env. */
export type WorkCommandContext = CmdContext & { workAuthority?: WorkAuthority };
export type WorkAdoptOptions = WorkIdOptions & {
  path: string;
  branch: string;
  base: string;
  sessionId: string;
};

async function workAdoptCommandImpl(
  ctx: CmdContext,
  opts: WorkAdoptOptions,
): Promise<CmdResult> {
  const items = await loadItems(ctx.projectRoot);
  const item = findItem(items, opts.id);
  if (!item) return errorResult(`Unknown work id: ${opts.id}`);
  if (!item.interview?.sealed_at)
    return errorResult('Seal the assignment before adopting its worktree.');
  const tree = await inspectWorktreeForAdoption({
    ...opts,
    projectRoot: ctx.projectRoot,
  });
  if (
    items.some(
      (other) =>
        other.id !== item.id &&
        other.worktree_path &&
        resolve(canonicalProjectRoot(ctx.projectRoot), other.worktree_path) ===
          tree.path,
    )
  ) {
    return errorResult(
      'This worktree is already assigned to another work item.',
    );
  }
  if (
    item.worktree_path &&
    (resolve(canonicalProjectRoot(ctx.projectRoot), item.worktree_path) !==
      tree.path ||
      item.worktree_branch !== tree.branch)
  )
    return errorResult(
      'Adoption cannot replace a preserved worktree association.',
    );
  if (
    item.worktree_adoption &&
    item.worktree_adoption.sessionId !== tree.sessionId
  ) {
    return errorResult(
      'Adoption cannot replace the preserved session identity.',
    );
  }
  item.worktree_path = tree.path;
  item.worktree_branch = tree.branch;
  item.worktree_adoption ??= tree;
  item.updated_at = nowIso();
  await saveItems(ctx.projectRoot, items);
  return opts.json
    ? jsonResult({ item, worktree: tree })
    : {
        output: `Adopted ${tree.path} (${tree.branch}) for ${item.id}; index and session preserved.`,
      };
}

const transactionContext = new AsyncLocalStorage<{
  dir: string;
  pending: Map<string, string>;
}>();
async function admission(
  ctx: WorkCommandContext,
  operation: string,
  opts: Record<string, unknown>,
): Promise<string | undefined> {
  let required = false;
  try {
    const policy = JSON.parse(
      await readFile(join(workDir(ctx.projectRoot), 'admission.json'), 'utf8'),
    );
    if (policy.requireAuthority !== true)
      return 'Invalid admission policy: requireAuthority must be true.';
    required = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!required) return;
  const actor = ctx.workAuthority;
  if (
    !actor?.actor?.trim() ||
    !['worker', 'reviewer', 'operator'].includes(actor.role)
  )
    return 'Trusted host work authority is required.';
  if (
    (opts.force || opts.forceScope || opts.allowInconclusive) &&
    actor.role !== 'operator'
  )
    return 'Only the operator may authorize an attributed override.';
  if (actor.role === 'operator') return;
  if (operation === 'Cleanup')
    return 'Only the operator may authorize destructive worktree cleanup.';
  if (actor.role === 'worker') {
    if (
      !['Claim', 'Start', 'Verify', 'EvidenceAttach', 'EvidencePair'].includes(
        operation,
      )
    )
      return 'Worker cannot change the assignment, close work, or manage worktrees.';
    const item = findItem(
      await loadItems(ctx.projectRoot),
      String(opts.id ?? ''),
    );
    if (
      !item ||
      actor.workId !== item.id ||
      !item.interview?.revision ||
      actor.sealedRevision !== item.interview.revision
    )
      return 'Worker assignment or sealed revision does not match.';
    if (item.assignee && item.assignee !== actor.actor)
      return 'Worker actor does not match the assignment.';
    if (opts.assignee && opts.assignee !== actor.actor)
      return 'Worker cannot claim as a different actor.';
    if (item.status === 'closed')
      return 'Closed work cannot receive worker mutations.';
    if (
      !['Claim', 'Start'].includes(operation) &&
      item.status !== 'in_progress'
    )
      return 'Start or claim the assigned work before submitting worker results or evidence.';
  }
  if (operation === 'Close') {
    const item = findItem(
      await loadItems(ctx.projectRoot),
      String(opts.id ?? ''),
    );
    const verification = item && latestVerification(item);
    if (
      !verification ||
      verification.actor !== actor.actor ||
      verification.role !== 'reviewer' ||
      verification.sealed_revision !== item?.interview?.revision
    )
      return 'Independent reviewer verification of the current sealed revision is required.';
    if (item?.assignee === actor.actor)
      return 'Closure requires an independent reviewer.';
    if (
      !item?.interview?.revision ||
      actor.sealedRevision !== item.interview.revision ||
      actor.workId !== item.id
    )
      return 'Reviewer must be bound to the current sealed assignment.';
  }
}

function transactional<O>(
  operation: string,
  fn: (ctx: CmdContext, opts: O) => Promise<CmdResult>,
) {
  return async (ctx: WorkCommandContext, opts: O): Promise<CmdResult> => {
    const dir = workDir(ctx.projectRoot);
    const run = async () => {
      const rejection = await admission(
        ctx,
        operation,
        (opts ?? {}) as Record<string, unknown>,
      );
      if (rejection) return errorResult(rejection);
      return fn(ctx, opts);
    };
    try {
      if (transactionContext.getStore()?.dir === dir) return await run();
      await mkdir(dir, { recursive: true });
      const lock = join(dir, 'transaction.lock');
      const deadline = Date.now() + 30_000;
      for (;;) {
        try {
          await mkdir(lock);
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          if (Date.now() >= deadline)
            throw new Error(
              `Work transaction lock is busy: ${lock}. A crashed owner requires operator inspection; locks are never stolen.`,
            );
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
      try {
        await writeFile(
          join(lock, 'owner.json'),
          JSON.stringify({ pid: process.pid, created_at: nowIso() }),
        );
        const transaction = { dir, pending: new Map<string, string>() };
        const result = await transactionContext.run(transaction, run);
        // A nested operation may have staged writes before a later refusal.
        // Publish only successful command state; evidence files may be orphaned, never accepted.
        if (!result.isError) {
          for (const [path, body] of transaction.pending)
            await writeTextAtomic(path, body);
        }
        return result;
      } finally {
        await rm(lock, { recursive: true });
      }
    } catch (error) {
      return errorResult((error as Error).message);
    }
  };
}

export async function workInitCommand(
  ctx: WorkCommandContext,
): Promise<CmdResult> {
  return transactional('Init', workInitCommandImpl)(ctx, undefined);
}

export const workCreateCommand = transactional('Create', workCreateCommandImpl);

export const workClaimCommand = transactional('Claim', workClaimCommandImpl);

export const workUpdateCommand = transactional('Update', workUpdateCommandImpl);

export const workCloseCommand = transactional('Close', workCloseCommandImpl);

export const workVerifyCommand = transactional('Verify', workVerifyCommandImpl);

export const workInterviewCommand = transactional(
  'Interview',
  workInterviewCommandImpl,
);

export const workAnswerCommand = transactional('Answer', workAnswerCommandImpl);

export const workAssumeCommand = transactional('Assume', workAssumeCommandImpl);

export const workAcceptCommand = transactional('Accept', workAcceptCommandImpl);

export const workSealCommand = transactional('Seal', workSealCommandImpl);

export const workDepCommand = transactional('Dep', workDepCommandImpl);

export const workStartCommand = transactional('Start', workStartCommandImpl);

export const workRememberCommand = transactional(
  'Remember',
  workRememberCommandImpl,
);

export const workIsolateCommand = transactional(
  'Isolate',
  workIsolateCommandImpl,
);

export const workCleanupCommand = transactional(
  'Cleanup',
  workCleanupCommandImpl,
);

export const workEvidenceAttachCommand = transactional(
  'EvidenceAttach',
  workEvidenceAttachCommandImpl,
);

export const workEvidencePairCommand = transactional(
  'EvidencePair',
  workEvidencePairCommandImpl,
);

export const workAdoptCommand = transactional('Adopt', workAdoptCommandImpl);

/** Host ingress: authority is an out-of-band context field, not part of request arguments. */
export async function workCommandWithAuthority(
  ctx: WorkCommandContext,
  request: { operation: string; options?: Record<string, unknown> },
): Promise<CmdResult> {
  const commands: Record<
    string,
    (ctx: WorkCommandContext, opts: any) => Promise<CmdResult>
  > = {
    init: workInitCommand,
    create: workCreateCommand,
    claim: workClaimCommand,
    update: workUpdateCommand,
    close: workCloseCommand,
    verify: workVerifyCommand,
    interview: workInterviewCommand,
    answer: workAnswerCommand,
    assume: workAssumeCommand,
    accept: workAcceptCommand,
    seal: workSealCommand,
    dep: workDepCommand,
    start: workStartCommand,
    remember: workRememberCommand,
    isolate: workIsolateCommand,
    cleanup: workCleanupCommand,
    adopt: workAdoptCommand,
    evidence_attach: workEvidenceAttachCommand,
    evidence_pair: workEvidencePairCommand,
    list: workListCommand,
    ready: workReadyCommand,
    show: workShowCommand,
    prime: workPrimeCommand,
    memories: workMemoriesCommand,
    evidence_list: workEvidenceListCommand,
  };
  const command = commands[request.operation];
  if (!Object.hasOwn(commands, request.operation) || !command)
    return errorResult('Unknown work operation.');
  return command(ctx, request.options ?? {});
}
