import { existsSync, realpathSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
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

/** Resolve from Git metadata, never a caller-provided store override. */
export function canonicalProjectRoot(projectRoot: string): string {
  const root = realpathSync(projectRoot);
  let common: string;
  try {
    common = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    return root; // Standalone, non-Git knowledge projects remain supported.
  }
  common = realpathSync(common);
  return common.endsWith('/.git') ? dirname(common) : common;
}

export type WorktreeAdoption = WorktreeInfo & {
  head: string;
  base: string;
  indexSha256: string;
  sessionId: string;
};

/** Observe only: adoption must never checkout, reset, fetch, stage, or prune. */
export async function inspectWorktreeForAdoption(options: {
  projectRoot: string;
  path: string;
  branch: string;
  base: string;
  sessionId: string;
}): Promise<WorktreeAdoption> {
  const path = realpathSync(resolve(options.projectRoot, options.path));
  const common = async (cwd: string) =>
    realpathSync(
      (
        await git(cwd, [
          'rev-parse',
          '--path-format=absolute',
          '--git-common-dir',
        ])
      ).stdout.trim(),
    );
  if ((await common(path)) !== (await common(options.projectRoot))) {
    throw new Error('Cannot adopt a worktree from another repository.');
  }
  const top = realpathSync(
    (await git(path, ['rev-parse', '--show-toplevel'])).stdout.trim(),
  );
  if (top !== path) throw new Error('Adoption path must be the worktree root.');
  const branch = (
    await git(path, ['symbolic-ref', '--short', 'HEAD'])
  ).stdout.trim();
  if (branch !== options.branch)
    throw new Error('Worktree branch does not match the preserved branch.');
  const sessionId = options.sessionId.trim();
  if (!sessionId) throw new Error('Preserved session identity is required.');
  const head = (await git(path, ['rev-parse', 'HEAD'])).stdout.trim();
  const base = (
    await git(path, ['rev-parse', '--verify', `${options.base}^{commit}`])
  ).stdout.trim();
  await git(path, ['merge-base', '--is-ancestor', base, head]);
  const index = (
    await git(path, [
      'rev-parse',
      '--path-format=absolute',
      '--git-path',
      'index',
    ])
  ).stdout.trim();
  const indexSha256 = createHash('sha256')
    .update(await readFile(index))
    .digest('hex');
  if (
    (await git(path, ['symbolic-ref', '--short', 'HEAD'])).stdout.trim() !==
      branch ||
    (await git(path, ['rev-parse', 'HEAD'])).stdout.trim() !== head ||
    createHash('sha256')
      .update(await readFile(index))
      .digest('hex') !== indexSha256
  ) {
    throw new Error(
      'Worktree identity/index changed during adoption; retry after concurrent Git activity ends.',
    );
  }
  return {
    path,
    branch,
    taskName: path.split('/').pop()!,
    head,
    base,
    indexSha256,
    sessionId,
  };
}

export function worktreesRoot(projectRoot: string): string {
  return join(canonicalProjectRoot(projectRoot), '.code-kg', 'worktrees');
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
      `Worktree already exists at ${relative(options.projectRoot, path)}. Use work adopt to reconcile the preserved checkout, or choose a different task.`,
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

  // Git normally runs post-checkout before an uncommitted knowledge graph can
  // be seeded. Defer checkout, populate this NEW tree, then run the full hook
  // with its normal arguments. No hook configuration is disabled or replaced.
  await git(options.projectRoot, [
    'worktree',
    'add',
    '--no-checkout',
    path,
    '-b',
    branch,
    base,
  ]);
  try {
    await git(path, ['read-tree', '--reset', '-u', 'HEAD']);
    const canonical = canonicalProjectRoot(options.projectRoot);
    for (const entry of ['lat.md', '.code-kg/materialization-manifest.json']) {
      const source = join(canonical, entry);
      const destination = join(path, entry);
      if (!existsSync(destination) && existsSync(source)) {
        await mkdir(dirname(destination), { recursive: true });
        await cp(source, destination, {
          recursive: true,
          force: false,
          errorOnExist: true,
          filter: (entryPath) => !entryPath.split('/').includes('.cache'),
        });
      }
    }
    const head = (await git(path, ['rev-parse', 'HEAD'])).stdout.trim();
    let requiredHook = false;
    try {
      const configured = (
        await git(path, ['config', '--get', 'core.hooksPath'])
      ).stdout.trim();
      const hooksPath = resolve(path, configured);
      requiredHook =
        hooksPath.endsWith('/code-kg-composed-hooks') ||
        existsSync(join(hooksPath, 'composition.json'));
    } catch {
      /* Ordinary repositories may have no configured hooks. */
    }
    await git(path, [
      'hook',
      'run',
      ...(requiredHook ? [] : ['--ignore-missing']),
      'post-checkout',
      '--',
      '0'.repeat(head.length),
      head,
      '1',
    ]);
  } catch (error) {
    throw new Error(
      `Worktree creation did not qualify: ${path} (${branch}) is preserved for inspection/adoption; no cleanup was performed. ${(error as Error).message}`,
    );
  }

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
  return join(
    canonicalProjectRoot(projectRoot),
    '.code-kg',
    'work',
    'evidence',
    workId,
  );
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
