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

export type GitHooksOptions = {
  action: 'install' | 'uninstall' | 'status';
  force?: boolean;
};

type GitHookState = 'installed' | 'missing' | 'foreign' | 'not-a-repo';

type GitHookStatus = {
  state: GitHookState;
  hookPath?: string;
};

function loadHookTemplate(): string {
  return readFileSync(join(findTemplatesDir(), 'git', 'pre-commit'), 'utf-8');
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

export async function installGitHook(
  projectRoot: string,
  opts: { force?: boolean } = {},
): Promise<string> {
  const hooksDir = resolveHooksDir(projectRoot);
  if (!hooksDir) return 'git pre-commit hook skipped (not a git repository)';

  const hookPath = join(hooksDir, 'pre-commit');
  const existing = await readText(hookPath);

  if (existing !== null && !isManagedHook(existing) && !opts.force) {
    return 'git pre-commit hook left untouched (a non-Code-KG pre-commit hook already exists; re-run with --force to replace it)';
  }

  await mkdir(hooksDir, { recursive: true });
  await writeFile(hookPath, loadHookTemplate());
  await chmod(hookPath, HOOK_MODE);

  if (existing === null) return 'installed git pre-commit hook';
  if (isManagedHook(existing)) return 'updated git pre-commit hook';
  return 'replaced existing pre-commit hook with the Code-KG hook (--force)';
}

export async function uninstallGitHook(projectRoot: string): Promise<string> {
  const hooksDir = resolveHooksDir(projectRoot);
  if (!hooksDir) return 'git pre-commit hook was not installed';

  const hookPath = join(hooksDir, 'pre-commit');
  const existing = await readText(hookPath);
  if (existing === null) return 'git pre-commit hook was not installed';
  if (!isManagedHook(existing)) {
    return 'left non-Code-KG pre-commit hook untouched';
  }
  await rm(hookPath);
  return 'removed git pre-commit hook';
}

export async function gitHookStatus(
  projectRoot: string,
): Promise<GitHookStatus> {
  const hooksDir = resolveHooksDir(projectRoot);
  if (!hooksDir) return { state: 'not-a-repo' };

  const hookPath = join(hooksDir, 'pre-commit');
  const existing = await readText(hookPath);
  if (existing === null) return { state: 'missing', hookPath };
  return {
    state: isManagedHook(existing) ? 'installed' : 'foreign',
    hookPath,
  };
}

export async function gitHookStatusLine(projectRoot: string): Promise<string> {
  const status = await gitHookStatus(projectRoot);
  switch (status.state) {
    case 'installed':
      return '- git pre-commit hook: installed';
    case 'foreign':
      return '- git pre-commit hook: missing (a non-Code-KG pre-commit hook is present)';
    case 'not-a-repo':
      return '- git pre-commit hook: n/a (not a git repository)';
    default:
      return '- git pre-commit hook: missing';
  }
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
        await gitHookStatusLine(ctx.projectRoot),
        '- Install command: code-kg git-hooks install',
      ].join('\n'),
    };
  }

  const change =
    opts.action === 'install'
      ? await installGitHook(ctx.projectRoot, { force: opts.force })
      : await uninstallGitHook(ctx.projectRoot);

  return {
    output: ['# Code-KG Git Hooks', '', `- ${change}`].join('\n'),
  };
}
