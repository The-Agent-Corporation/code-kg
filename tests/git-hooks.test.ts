import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  installGitHook,
  installGitHooks,
  uninstallGitHook,
  uninstallGitHooks,
  gitHookStatus,
  gitHookStatuses,
  MANAGED_GIT_HOOKS,
} from '../src/codekg/git-hooks.js';

function gitInit(dir: string): void {
  execFileSync('git', ['init', '-q'], { cwd: dir });
}

describe('git-hooks', () => {
  let root: string;
  let hooksDir: string;

  beforeEach(() => {
    root = join(tmpdir(), `codekg-githook-${Date.now()}-${Math.random()}`);
    mkdirSync(root, { recursive: true });
    hooksDir = join(root, '.git', 'hooks');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('installs executable managed pre-commit, post-merge, and post-checkout hooks', async () => {
    gitInit(root);
    const messages = await installGitHooks(root);

    expect(messages).toEqual([
      'installed git pre-commit hook',
      'installed git post-merge hook',
      'installed git post-checkout hook',
    ]);

    for (const name of MANAGED_GIT_HOOKS) {
      const hookPath = join(hooksDir, name);
      expect(existsSync(hookPath)).toBe(true);
      const body = readFileSync(hookPath, 'utf-8');
      expect(body).toContain('# code-kg:managed-hook');
      expect(body).toContain('code-kg --dir "$repo_root" update');
      expect(statSync(hookPath).mode & 0o111).not.toBe(0);
    }

    const statuses = await gitHookStatuses(root);
    expect(statuses.every((s) => s.state === 'installed')).toBe(true);

    const summary = await installGitHook(root);
    expect(summary).toContain('installed git hooks');
    expect(summary).toContain('pre-commit');
    expect(summary).toContain('post-merge');
    expect(summary).toContain('post-checkout');
  });

  it('updates in place when Code-KG hooks are already present', async () => {
    gitInit(root);
    await installGitHooks(root);
    const messages = await installGitHooks(root);
    expect(messages).toEqual([
      'updated git pre-commit hook',
      'updated git post-merge hook',
      'updated git post-checkout hook',
    ]);
  });

  it('refuses to clobber a foreign pre-commit hook unless forced', async () => {
    gitInit(root);
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'pre-commit'), '#!/bin/sh\necho "mine"\n');

    const messages = await installGitHooks(root);
    expect(messages[0]).toContain('left untouched');
    expect(readFileSync(join(hooksDir, 'pre-commit'), 'utf-8')).toContain(
      'echo "mine"',
    );
    expect((await gitHookStatus(root)).state).toBe('foreign');
    // Sibling hooks can still install.
    expect(messages[1]).toBe('installed git post-merge hook');
    expect(messages[2]).toBe('installed git post-checkout hook');

    const forced = await installGitHooks(root, { force: true });
    expect(forced[0]).toContain('--force');
    expect(readFileSync(join(hooksDir, 'pre-commit'), 'utf-8')).toContain(
      '# code-kg:managed-hook',
    );
  });

  it('uninstall removes only managed hooks', async () => {
    gitInit(root);
    await installGitHooks(root);
    expect(await uninstallGitHooks(root)).toEqual([
      'removed git pre-commit hook',
      'removed git post-merge hook',
      'removed git post-checkout hook',
    ]);
    for (const name of MANAGED_GIT_HOOKS) {
      expect(existsSync(join(hooksDir, name))).toBe(false);
    }

    writeFileSync(join(hooksDir, 'pre-commit'), '#!/bin/sh\necho "mine"\n');
    expect(await uninstallGitHook(root)).toContain('untouched');
    expect(existsSync(join(hooksDir, 'pre-commit'))).toBe(true);
  });

  it('is a no-op (with a clear message) outside a git repository', async () => {
    expect(await installGitHook(root)).toContain('not a git repository');
    expect((await gitHookStatus(root)).state).toBe('not-a-repo');
  });
});
