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
  uninstallGitHook,
  gitHookStatus,
} from '../src/codekg/git-hooks.js';

function gitInit(dir: string): void {
  execFileSync('git', ['init', '-q'], { cwd: dir });
}

describe('git-hooks', () => {
  let root: string;
  let hookPath: string;

  beforeEach(() => {
    root = join(tmpdir(), `codekg-githook-${Date.now()}-${Math.random()}`);
    mkdirSync(root, { recursive: true });
    hookPath = join(root, '.git', 'hooks', 'pre-commit');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('installs an executable, Code-KG-managed pre-commit hook', async () => {
    gitInit(root);
    const msg = await installGitHook(root);

    expect(msg).toBe('installed git pre-commit hook');
    expect(existsSync(hookPath)).toBe(true);
    const body = readFileSync(hookPath, 'utf-8');
    expect(body).toContain('# code-kg:managed-hook');
    expect(body).toContain('code-kg --dir "$repo_root" update');
    // Executable bit set.
    expect(statSync(hookPath).mode & 0o111).not.toBe(0);

    const status = await gitHookStatus(root);
    expect(status.state).toBe('installed');
  });

  it('updates in place when a Code-KG hook is already present', async () => {
    gitInit(root);
    await installGitHook(root);
    const msg = await installGitHook(root);
    expect(msg).toBe('updated git pre-commit hook');
  });

  it('refuses to clobber a foreign pre-commit hook unless forced', async () => {
    gitInit(root);
    mkdirSync(join(root, '.git', 'hooks'), { recursive: true });
    writeFileSync(hookPath, '#!/bin/sh\necho "mine"\n');

    const msg = await installGitHook(root);
    expect(msg).toContain('left untouched');
    expect(readFileSync(hookPath, 'utf-8')).toContain('echo "mine"');
    expect((await gitHookStatus(root)).state).toBe('foreign');

    const forced = await installGitHook(root, { force: true });
    expect(forced).toContain('--force');
    expect(readFileSync(hookPath, 'utf-8')).toContain('# code-kg:managed-hook');
  });

  it('uninstall removes only a managed hook', async () => {
    gitInit(root);
    await installGitHook(root);
    expect(await uninstallGitHook(root)).toBe('removed git pre-commit hook');
    expect(existsSync(hookPath)).toBe(false);

    // A foreign hook is never removed.
    writeFileSync(hookPath, '#!/bin/sh\necho "mine"\n');
    expect(await uninstallGitHook(root)).toContain('untouched');
    expect(existsSync(hookPath)).toBe(true);
  });

  it('is a no-op (with a clear message) outside a git repository', async () => {
    expect(await installGitHook(root)).toContain('not a git repository');
    expect((await gitHookStatus(root)).state).toBe('not-a-repo');
  });
});
