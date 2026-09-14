import { existsSync, readFileSync } from 'node:fs';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { isAbsolute, join, resolve } from 'node:path';
import type { CmdContext, CmdResult } from '../context.js';
import { findTemplatesDir } from '../cli/templates.js';

// Robust marker so `status`/`uninstall` only ever touch a hook we installed.
const MANAGED_MARKER = '# code-kg:managed-hook';
const LEGACY_MARKER = '# Code-KG pre-commit hook';
const HOOK_MODE = 0o755;

/** Managed git hooks installed by Code-KG. */
export const MANAGED_GIT_HOOKS = [
  'pre-commit',
  'post-merge',
  'post-checkout',
] as const;

export type ManagedGitHookName = (typeof MANAGED_GIT_HOOKS)[number];

export type GitHooksOptions = {
  action: 'install' | 'uninstall' | 'status';
  force?: boolean;
};

type GitHookState = 'installed' | 'missing' | 'foreign' | 'not-a-repo';

type GitHookStatus = {
  name: ManagedGitHookName;
  state: GitHookState;
  hookPath?: string;
};

function loadHookTemplate(name: ManagedGitHookName): string {
  return readFileSync(join(findTemplatesDir(), 'git', name), 'utf-8');
}

/**
 * Resolve the repo's git hooks directory, honoring `core.hooksPath` and
 * worktrees. Returns null when `projectRoot` is not inside a git work tree.
 */
function resolveHooksDir(projectRoot: string): string | null {
  let raw: string;
  try {
    raw = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
  if (!raw) return null;
  return isAbsolute(raw) ? raw : resolve(projectRoot, raw);
}

function isManagedHook(content: string): boolean {
  return content.includes(MANAGED_MARKER) || content.includes(LEGACY_MARKER);
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function installOneGitHook(
  projectRoot: string,
  name: ManagedGitHookName,
  opts: { force?: boolean } = {},
): Promise<string> {
  const hooksDir = resolveHooksDir(projectRoot);
  if (!hooksDir) return `git ${name} hook skipped (not a git repository)`;

  const hookPath = join(hooksDir, name);
  const existing = await readText(hookPath);

  if (existing !== null && !isManagedHook(existing) && !opts.force) {
    return `git ${name} hook left untouched (a non-Code-KG ${name} hook already exists; re-run with --force to replace it)`;
  }

  await mkdir(hooksDir, { recursive: true });
  await writeFile(hookPath, loadHookTemplate(name));
  await chmod(hookPath, HOOK_MODE);

  if (existing === null) return `installed git ${name} hook`;
  if (isManagedHook(existing)) return `updated git ${name} hook`;
  return `replaced existing ${name} hook with the Code-KG hook (--force)`;
}

async function uninstallOneGitHook(
  projectRoot: string,
  name: ManagedGitHookName,
): Promise<string> {
  const hooksDir = resolveHooksDir(projectRoot);
  if (!hooksDir) return `git ${name} hook was not installed`;

  const hookPath = join(hooksDir, name);
  const existing = await readText(hookPath);
  if (existing === null) return `git ${name} hook was not installed`;
  if (!isManagedHook(existing)) {
    return `left non-Code-KG ${name} hook untouched`;
  }
  await rm(hookPath);
  return `removed git ${name} hook`;
}

/** Install every managed git hook. Returns one status line per hook. */
export async function installGitHooks(
  projectRoot: string,
  opts: { force?: boolean } = {},
): Promise<string[]> {
  const results: string[] = [];
  for (const name of MANAGED_GIT_HOOKS) {
    results.push(await installOneGitHook(projectRoot, name, opts));
  }
  return results;
}

/**
 * Install managed git hooks. Returns a single summary string for callers that
 * expect one change line (e.g. `code-kg init`).
 */
export async function installGitHook(
  projectRoot: string,
  opts: { force?: boolean } = {},
): Promise<string> {
  const results = await installGitHooks(projectRoot, opts);
  const skipped = results.every((line) => line.includes('not a git repository'));
  if (skipped) return 'git hooks skipped (not a git repository)';
  const installed = results.filter((line) =>
    /^(installed|updated|replaced) /.test(line),
  );
  if (installed.length === results.length) {
    return `installed git hooks (${MANAGED_GIT_HOOKS.join(', ')})`;
  }
  return results.join('; ');
}

export async function uninstallGitHooks(
  projectRoot: string,
): Promise<string[]> {
  const results: string[] = [];
  for (const name of MANAGED_GIT_HOOKS) {
    results.push(await uninstallOneGitHook(projectRoot, name));
  }
  return results;
}

export async function uninstallGitHook(projectRoot: string): Promise<string> {
  const results = await uninstallGitHooks(projectRoot);
  const removed = results.filter((line) => line.startsWith('removed '));
  if (removed.length === MANAGED_GIT_HOOKS.length) {
    return `removed git hooks (${MANAGED_GIT_HOOKS.join(', ')})`;
  }
  if (results.every((line) => line.includes('was not installed'))) {
    return 'git hooks were not installed';
  }
  return results.join('; ');
}

export async function gitHookStatuses(
  projectRoot: string,
): Promise<GitHookStatus[]> {
  const hooksDir = resolveHooksDir(projectRoot);
  if (!hooksDir) {
    return MANAGED_GIT_HOOKS.map((name) => ({ name, state: 'not-a-repo' }));
  }

  const statuses: GitHookStatus[] = [];
  for (const name of MANAGED_GIT_HOOKS) {
    const hookPath = join(hooksDir, name);
    const existing = await readText(hookPath);
    if (existing === null) {
      statuses.push({ name, state: 'missing', hookPath });
      continue;
    }
    statuses.push({
      name,
      state: isManagedHook(existing) ? 'installed' : 'foreign',
      hookPath,
    });
  }
  return statuses;
}

/** @deprecated Prefer gitHookStatuses — kept for single-hook callers/tests. */
export async function gitHookStatus(
  projectRoot: string,
): Promise<{ state: GitHookState; hookPath?: string }> {
  const statuses = await gitHookStatuses(projectRoot);
  const preCommit = statuses.find((s) => s.name === 'pre-commit');
  if (!preCommit) return { state: 'missing' };
  return { state: preCommit.state, hookPath: preCommit.hookPath };
}

function formatHookStatusLine(status: GitHookStatus): string {
  switch (status.state) {
    case 'installed':
      return `- git ${status.name} hook: installed`;
    case 'foreign':
      return `- git ${status.name} hook: missing (a non-Code-KG ${status.name} hook is present)`;
    case 'not-a-repo':
      return `- git ${status.name} hook: n/a (not a git repository)`;
    default:
      return `- git ${status.name} hook: missing`;
  }
}

export async function gitHookStatusLines(
  projectRoot: string,
): Promise<string[]> {
  return (await gitHookStatuses(projectRoot)).map(formatHookStatusLine);
}

export async function gitHookStatusLine(projectRoot: string): Promise<string> {
  const statuses = await gitHookStatuses(projectRoot);
  const installed = statuses.filter((s) => s.state === 'installed').length;
  if (statuses[0]?.state === 'not-a-repo') {
    return '- git hooks: n/a (not a git repository)';
  }
  if (installed === MANAGED_GIT_HOOKS.length) {
    return `- git hooks: installed (${MANAGED_GIT_HOOKS.join(', ')})`;
  }
  if (installed === 0) {
    const foreign = statuses.some((s) => s.state === 'foreign');
    return foreign
      ? '- git hooks: missing (one or more non-Code-KG hooks are present)'
      : '- git hooks: missing';
  }
  return `- git hooks: partial (${installed}/${MANAGED_GIT_HOOKS.length} installed)`;
}

export async function gitHooksCommand(
  ctx: CmdContext,
  opts: GitHooksOptions,
): Promise<CmdResult> {
  if (opts.action === 'status') {
    return {
      output: [
        '# Code-KG Git Hooks',
        '',
        existsSync(ctx.latDir) ? '- lat.md/: found' : '- lat.md/: missing',
        ...(await gitHookStatusLines(ctx.projectRoot)),
        '- Install command: code-kg git-hooks install',
      ].join('\n'),
    };
  }

  const changes =
    opts.action === 'install'
      ? await installGitHooks(ctx.projectRoot, { force: opts.force })
      : await uninstallGitHooks(ctx.projectRoot);

  return {
    output: [
      '# Code-KG Git Hooks',
      '',
      ...changes.map((change) => `- ${change}`),
    ].join('\n'),
  };
}
