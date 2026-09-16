import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  installComposedGitHooks,
  installGitHooks,
  uninstallGitHooks,
} from '../src/codekg/git-hooks.js';

describe('composed Git guards', () => {
  let root: string;
  let env: NodeJS.ProcessEnv;
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'codekg-composition-'));
    env = { ...process.env, PATH: `${root}/bin:${process.env.PATH}` };
    git('init', '-q');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    for (const dir of ['bin', 'lat.md', '.code-kg', '.githooks'])
      mkdirSync(join(root, dir));
    writeFileSync(join(root, '.code-kg/materialization-manifest.json'), '{}');
    writeFileSync(join(root, 'lat.md/test.md'), 'initial');
    writeFileSync(
      join(root, '.githooks/pre-commit'),
      '#!/bin/sh\nset -eu\necho final >> "$PWD/order"\ngit show :lat.md/test.md | grep -q unsafe && exit 9\nexit 0\n',
      { mode: 0o755 },
    );
    writeFileSync(
      join(root, 'bin/code-kg'),
      '#!/bin/sh\nset -eu\necho update >> "$PWD/order"\n[ ! -f fail-update ] || exit 7\nif [ -f unsafe ]; then echo unsafe > lat.md/test.md; else echo safe > lat.md/test.md; fi\n[ ! -f fail-stage ] || touch .git/index.lock\n',
      { mode: 0o755 },
    );
    git('add', '.');
    git('commit', '-qm', 'fixture');
    git('config', 'core.hooksPath', '.githooks');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const commit = () =>
    spawnSync('git', ['commit', '--allow-empty', '-qm', 'test'], {
      cwd: root,
      env,
      encoding: 'utf8',
    });
  const install = () =>
    installComposedGitHooks(root, { finalPreCommit: '.githooks/pre-commit' });

  it('checks the generated final index, aborts either failure, and survives reinstall and branch checkout', async () => {
    const original = readFileSync(join(root, '.githooks/pre-commit'), 'utf8');
    await install();
    expect(commit().status).toBe(0);
    expect(readFileSync(join(root, 'order'), 'utf8')).toBe('update\nfinal\n');
    writeFileSync(join(root, 'unsafe'), '');
    const before = git('rev-parse', 'HEAD');
    expect(commit().status).not.toBe(0);
    expect(git('rev-parse', 'HEAD')).toBe(before);
    expect(git('show', ':lat.md/test.md')).toBe('unsafe');
    rmSync(join(root, 'unsafe'));
    writeFileSync(join(root, 'fail-update'), '');
    writeFileSync(join(root, 'order'), '');
    expect(commit().status).not.toBe(0);
    expect(readFileSync(join(root, 'order'), 'utf8')).toBe('update\n');
    rmSync(join(root, 'fail-update'));
    await install();
    const hook = git('rev-parse', '--git-path', 'hooks/pre-commit');
    const dispatcher = readFileSync(hook, 'utf8');
    await installGitHooks(root, { force: true });
    expect(readFileSync(hook, 'utf8')).toBe(dispatcher);
    expect(readFileSync(join(root, '.githooks/pre-commit'), 'utf8')).toBe(
      original,
    );
    expect(commit().status).toBe(0);
    git('checkout', '-qb', 'other');
    expect(readFileSync(hook, 'utf8')).toBe(dispatcher);
    writeFileSync(join(root, 'unsafe'), '');
    expect(commit().status).not.toBe(0);
  });

  it('refuses staging failure, missing CLI, missing setup, and missing final guard', async () => {
    await install();
    writeFileSync(join(root, 'fail-stage'), '');
    const staging = commit();
    expect(staging.status).not.toBe(0);
    expect(staging.stderr).toContain('Staging knowledge files failed');
    rmSync(join(root, '.git/index.lock'));
    rmSync(join(root, 'fail-stage'));
    rmSync(join(root, 'bin/code-kg'));
    expect(commit().status).not.toBe(0);
    // Setup is checked before invocation, even with an executable present.
    writeFileSync(join(root, 'bin/code-kg'), '#!/bin/sh\nexit 0\n', {
      mode: 0o755,
    });
    rmSync(join(root, '.code-kg/materialization-manifest.json'));
    expect(commit().status).not.toBe(0);
    writeFileSync(join(root, '.code-kg/materialization-manifest.json'), '{}');
    chmodSync(join(root, '.githooks/pre-commit'), 0o644);
    expect(commit().stderr).toContain('Final repository guard missing');
    expect(
      (await uninstallGitHooks(root)).every((s) => s.includes('left composed')),
    ).toBe(true);
    expect(existsSync(git('rev-parse', '--git-path', 'hooks/pre-commit'))).toBe(
      true,
    );
  });

  it('retains an existing foreign post hook and refuses to discard an unrelated active pre-commit', async () => {
    writeFileSync(
      join(root, '.githooks/post-checkout'),
      '#!/bin/sh\necho original-post >> "$PWD/order"\n',
      { mode: 0o755 },
    );
    await install();
    git('checkout', '-qb', 'second');
    expect(readFileSync(join(root, 'order'), 'utf8')).toContain(
      'original-post',
    );
    git('config', 'core.hooksPath', '.git/hooks');
    writeFileSync(join(root, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 1\n');
    await expect(install()).rejects.toThrow('Active hooks changed');
  });
});
