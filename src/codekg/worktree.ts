import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomBytes } from 'node:crypto';

const execFileAsync = promisify(execFile);

export type WorktreeInfo = {
  path: string;
  branch: string;
  taskName: string;
};

export type ScopeConflict = {
  prNumber: number;
  title: string;
  overlappingFiles: string[];
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function worktreesRoot(projectRoot: string): string {
  return join(projectRoot, '.code-kg', 'worktrees');
}

export async function ensureWorktreesIgnored(
  projectRoot: string,
): Promise<void> {
  const gitignorePath = join(projectRoot, '.gitignore');
  const marker = '.code-kg/worktrees/';
  let existing = '';
  try {
    existing = await readFile(gitignorePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (existing.split('\n').some((line) => line.trim() === marker)) return;
  const prefix = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  await writeFile(
    gitignorePath,
    `${existing}${prefix}# Code-KG agent worktrees\n${marker}\n`,
    'utf8',
  );
}

async function git(
  projectRoot: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, {
    cwd: projectRoot,
    maxBuffer: 4 * 1024 * 1024,
  });
}

export async function isGitRepo(projectRoot: string): Promise<boolean> {
  try {
    const { stdout } = await git(projectRoot, [
      'rev-parse',
      '--is-inside-work-tree',
    ]);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

export async function fetchOriginMain(projectRoot: string): Promise<void> {
  try {
    await git(projectRoot, ['fetch', 'origin', 'main']);
  } catch {
    // Offline / missing remote is fine; createIsolatedWorktree falls back.
  }
}

export function buildTaskName(title: string, workId: string): string {
  const base = slugify(title) || 'task';
  const suffix =
    workId.replace(/^ck-/, '').slice(0, 6) || randomBytes(2).toString('hex');
  return `${base}-${suffix}`;
}

export async function createIsolatedWorktree(options: {
  projectRoot: string;
  workId: string;
  title: string;
  branchPrefix?: string;
}): Promise<WorktreeInfo> {
  if (!(await isGitRepo(options.projectRoot))) {
    throw new Error('Not a git repository; cannot create a worktree.');
  }

  await ensureWorktreesIgnored(options.projectRoot);
  await fetchOriginMain(options.projectRoot);

  const taskName = buildTaskName(options.title, options.workId);
  const branchPrefix = options.branchPrefix ?? 'agent';
  const branch = `${branchPrefix}/${taskName}`;
  const path = join(worktreesRoot(options.projectRoot), taskName);

  if (existsSync(path)) {
    throw new Error(
      `Worktree already exists at ${relative(options.projectRoot, path)}. Choose a different task or run work cleanup.`,
    );
  }

  await mkdir(dirname(path), { recursive: true });

  let base = 'origin/main';
  try {
    await git(options.projectRoot, ['rev-parse', '--verify', base]);
  } catch {
    try {
      await git(options.projectRoot, ['rev-parse', '--verify', 'main']);
      base = 'main';
    } catch {
      const { stdout } = await git(options.projectRoot, [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ]);
      base = stdout.trim() || 'HEAD';
    }
  }

  await git(options.projectRoot, [
    'worktree',
    'add',
    path,
    '-b',
    branch,
    base,
  ]);

  return { path, branch, taskName };
}

export async function removeIsolatedWorktree(options: {
  projectRoot: string;
  worktreePath: string;
  branch?: string;
  force?: boolean;
}): Promise<void> {
  const absolute = resolve(options.projectRoot, options.worktreePath);
  if (!existsSync(absolute)) {
    if (options.branch) {
      try {
        await git(options.projectRoot, ['branch', '-D', options.branch]);
      } catch {
        // Branch may already be gone.
      }
    }
    return;
  }

  const args = ['worktree', 'remove', absolute];
  if (options.force) args.push('--force');
  await git(options.projectRoot, args);

  if (options.branch) {
    try {
      await git(options.projectRoot, ['branch', '-D', options.branch]);
    } catch {
      // Expected after squash merges.
    }
  }

  try {
    await rm(absolute, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export async function listOpenPrOverlaps(options: {
  projectRoot: string;
  candidatePaths: string[];
}): Promise<ScopeConflict[]> {
  if (!options.candidatePaths.length) return [];
  try {
    const { stdout } = await execFileAsync(
      'gh',
      ['pr', 'list', '--state', 'open', '--json', 'number,title,files'],
      { cwd: options.projectRoot, maxBuffer: 8 * 1024 * 1024 },
    );
    const prs = JSON.parse(stdout) as Array<{
      number: number;
      title: string;
      files?: Array<{ path: string }>;
    }>;
    const wanted = new Set(
      options.candidatePaths.map((path) => path.replace(/\\/g, '/')),
    );
    const conflicts: ScopeConflict[] = [];
    for (const pr of prs) {
      const overlappingFiles = (pr.files ?? [])
        .map((file) => file.path)
        .filter((path) => wanted.has(path));
      if (overlappingFiles.length) {
        conflicts.push({
          prNumber: pr.number,
          title: pr.title,
          overlappingFiles,
        });
      }
    }
    return conflicts;
  } catch {
    return [];
  }
}

export function evidenceDir(projectRoot: string, workId: string): string {
  return join(projectRoot, '.code-kg', 'work', 'evidence', workId);
}

export function stableEvidenceName(label: string, ext: string): string {
  const slug = slugify(label) || 'capture';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const hash = createHash('sha1')
    .update(`${label}:${stamp}`)
    .digest('hex')
    .slice(0, 6);
  return `${stamp}-${slug}-${hash}.${ext.replace(/^\./, '')}`;
}
