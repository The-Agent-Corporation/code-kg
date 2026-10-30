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

describe('installed pre-commit hook', () => {
  const cliPath = join(
    import.meta.dirname,
    '..',
    'dist',
    'src',
    'codekg',
    'cli.js',
  );
  let root: string;
  let bin: string;
  let env: NodeJS.ProcessEnv;

  const git = (...args: string[]) =>
    execFileSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
      {
        cwd: root,
        env,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

  beforeEach(async () => {
    const base = join(
      tmpdir(),
      `codekg-hookrun-${Date.now()}-${Math.random()}`,
    );
    root = join(base, 'repo');
    bin = join(base, 'bin');
    mkdirSync(join(root, 'src'), { recursive: true });
    mkdirSync(bin, { recursive: true });
    writeFileSync(
      join(bin, 'code-kg'),
      `#!/bin/sh\necho "$CODEKG_SKIP_ENRICH" > "${join(base, 'skip-enrich')}"\nexec "${process.execPath}" "${cliPath}" "$@"\n`,
      { mode: 0o755 },
    );
    env = {
      ...process.env,
      PATH: bin + ':' + process.env.PATH,
      LAT_LLM_KEY: '',
      CODEKG_SKIP_ENRICH: '',
    };
    delete env.CODEKG_SKIP_ENRICH;
    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1;\n');
    gitInit(root);
    execFileSync(process.execPath, [cliPath, 'bootstrap', '--accept'], {
      cwd: root,
      env,
      stdio: 'ignore',
    });
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'init');
    await installGitHook(root);
  });

  afterEach(() => {
    rmSync(join(root, '..'), { recursive: true, force: true });
  });

  it('stages the refreshed knowledge base and skips LLM enrichment', () => {
    writeFileSync(join(root, 'src', 'b.ts'), 'export const b = 2;\n');
    git('add', 'src/b.ts');
    git('commit', '-q', '-m', 'add b');

    const files = git('show', '--name-only', '--format=', 'HEAD');
    expect(files).toContain('src/b.ts');
    expect(files).toContain('.code-kg/materialization-manifest.json');
    expect(readFileSync(join(root, '..', 'skip-enrich'), 'utf-8').trim()).toBe(
      '1',
    );
  }, 60_000);

  it('does not sweep unstaged knowledge-base edits into the commit', () => {
    const doc = join(root, 'lat.md', 'architecture.md');
    writeFileSync(doc, readFileSync(doc, 'utf-8') + '\nMy unstaged note.\n');
    writeFileSync(join(root, 'src', 'b.ts'), 'export const b = 2;\n');
    git('add', 'src/b.ts');
    git('commit', '-q', '-m', 'add b');

    expect(git('show', '--name-only', '--format=', 'HEAD').trim()).toBe(
      'src/b.ts',
    );
    expect(git('show', 'HEAD:lat.md/architecture.md')).not.toContain(
      'My unstaged note.',
    );
    expect(readFileSync(doc, 'utf-8')).toContain('My unstaged note.');
  }, 60_000);
});
