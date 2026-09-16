// Synthetic-only live witness using Roscoe's unchanged tracked guard.
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { installComposedGitHooks, installGitHooks } from '../dist/src/codekg/git-hooks.js';
const roscoe = process.argv[2];
if (!roscoe) throw new Error('Usage: node integration/verify-roscoe-git-guards.mjs <Roscoe checkout>');
const root = mkdtempSync(join(tmpdir(), 'roscoe-codekg-guard-proof-'));
try {
  for (const dir of ['bin', '.code-kg', '.githooks', 'tools', 'lat.md', 'synthetic-home', 'synthetic-matters/Quilbystone']) mkdirSync(join(root, dir), { recursive: true });
  const env = { ...process.env, PATH: `${root}/bin:${process.env.PATH}`, ROSCOE_HOME: join(root, 'synthetic-home'), ROSCOE_MATTERS_DIR: join(root, 'synthetic-matters') };
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
  git('init', '-q'); git('config', 'user.name', 'Synthetic fixture'); git('config', 'user.email', 'fixture@example.invalid');
  copyFileSync(join(roscoe, '.githooks/pre-commit'), join(root, '.githooks/pre-commit'));
  copyFileSync(join(roscoe, 'tools/case-slug-gate.py'), join(root, 'tools/case-slug-gate.py'));
  writeFileSync(join(root, '.code-kg/materialization-manifest.json'), '{}');
  writeFileSync(join(root, 'lat.md/witness.md'), 'safe');
  writeFileSync(join(root, 'bin/code-kg'), '#!/bin/sh\n[ ! -f fail-update ] || exit 8\nif [ -f inject-name ]; then echo Quilbystone > lat.md/witness.md; else echo safe > lat.md/witness.md; fi\n', { mode: 0o755 });
  git('add', '.githooks', 'tools', '.code-kg', 'lat.md'); git('commit', '-qm', 'synthetic baseline');
  await installComposedGitHooks(root, { finalPreCommit: '.githooks/pre-commit' });
  const commit = () => spawnSync('git', ['commit', '--allow-empty', '-qm', 'witness'], { cwd: root, env, encoding: 'utf8' });
  const clean = commit(); if (clean.status !== 0) throw new Error(clean.stderr);
  writeFileSync(join(root, 'inject-name'), '');
  const before = git('rev-parse', 'HEAD');
  const rejected = commit(); if (rejected.status === 0 || git('rev-parse', 'HEAD') !== before) throw new Error('Roscoe guard failed to reject generated name');
  if (!git('show', ':lat.md/witness.md').includes('Quilbystone')) throw new Error('Generated name was not staged before final guard');
  rmSync(join(root, 'inject-name')); writeFileSync(join(root, 'fail-update'), '');
  if (commit().status === 0) throw new Error('Code-KG update failure was not rejected');
  rmSync(join(root, 'fail-update'));
  const hooks = git('rev-parse', '--git-path', 'hooks/pre-commit'); const original = readFileSync(hooks, 'utf8');
  await installGitHooks(root, { force: true }); if (readFileSync(hooks, 'utf8') !== original) throw new Error('Reinstall replaced dispatcher');
  const recovered = commit(); if (recovered.status !== 0) throw new Error(recovered.stderr);
  git('checkout', '-qb', 'witness-branch');
  writeFileSync(join(root, 'inject-name'), ''); if (commit().status === 0) throw new Error('Checkout lost Roscoe final guard');
  console.log(JSON.stringify({ fixture: 'synthetic-only; real unmodified Roscoe pre-commit and case-slug-gate.py', passing_commit: true, generated_staged_name_rejected: true, update_failure_rejected: true, reinstall_preserved: true, checkout_preserved: true, note: 'Code-KG update is a deterministic fixture executable; full graph/runtime qualification is separate.' }, null, 2));
} finally { rmSync(root, { recursive: true, force: true }); }
