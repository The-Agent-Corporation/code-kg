import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { plainStyler } from '../src/context.js';
import { createCodeKgMcpServer } from '../src/codekg/mcp.js';
import {
  workCommandWithAuthority,
  type WorkCommandContext,
} from '../src/codekg/work.js';

const exec = promisify(execFile);
const roots: string[] = [];
const cli = fileURLToPath(
  new URL('../dist/src/codekg/cli.js', import.meta.url),
);
const ctx = (projectRoot: string): WorkCommandContext => ({
  projectRoot,
  latDir: join(projectRoot, 'lat.md'),
  mode: 'cli',
  styler: plainStyler,
});
const run = (
  c: WorkCommandContext,
  operation: string,
  options: Record<string, unknown> = {},
) =>
  workCommandWithAuthority(c, {
    operation,
    options: { ...options, json: true },
  });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ck-shared-'));
  roots.push(root);
  await exec('git', ['init', '-b', 'main', root]);
  await exec('git', ['config', 'user.name', 'Fixture'], { cwd: root });
  await exec('git', ['config', 'user.email', 'fixture@example.test'], {
    cwd: root,
  });
  await writeFile(join(root, 'tracked'), 'original\n');
  await exec('git', ['add', 'tracked'], { cwd: root });
  await exec('git', ['commit', '-m', 'fixture'], { cwd: root });
  const tree = join(root, 'existing-worktree');
  await exec('git', ['worktree', 'add', '-b', 'preserved', tree], {
    cwd: root,
  });
  return { root, tree };
}
async function sealed(c: WorkCommandContext, title = 'sealed fixture') {
  const item = JSON.parse(
    (await run(c, 'create', { title, acceptance: ['Preserve identity'] }))
      .output,
  );
  const interview = JSON.parse(
    (await run(c, 'interview', { id: item.id })).output,
  );
  for (const question of interview.questions)
    expect(
      (
        await run(c, 'answer', {
          id: item.id,
          question: question.id,
          answer: 'Explicit fixture answer',
        })
      ).isError,
    ).toBeFalsy();
  const result = await run(c, 'seal', { id: item.id });
  expect(result.isError, result.output).toBeFalsy();
  return JSON.parse(result.output);
}
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

it('rejects unsealed execution and alternate sealed-contract/status mutation paths', async () => {
  const { root } = await fixture();
  const c = ctx(root);
  const id = JSON.parse(
    (await run(c, 'create', { title: 'not sealed' })).output,
  ).id;
  for (const operation of ['claim', 'start', 'isolate'])
    expect((await run(c, operation, { id })).isError).toBe(true);
  expect((await run(c, 'update', { id, status: 'closed' })).isError).toBe(true);
  expect((await run(c, 'update', { id, status: 'in_progress' })).isError).toBe(
    true,
  );
  const item = await sealed(c);
  for (const [operation, options] of [
    ['accept', { criterion: 'Changed acceptance' }],
    ['assume', { text: 'Changed assumption' }],
    ['update', { description: 'Changed brief' }],
    ['dep', { blocks: id }],
  ] as const)
    expect((await run(c, operation, { id: item.id, ...options })).isError).toBe(
      true,
    );
  expect((await run(c, 'claim', { id: item.id })).isError).toBeFalsy();
  expect(
    (await run(c, 'interview', { id: item.id, refresh: true })).isError,
  ).toBe(true);
});

it('adopts without changing staged bytes, branch, HEAD, untracked files or session; refuses wrong identity', async () => {
  const { root, tree } = await fixture();
  const item = await sealed(ctx(root));
  await writeFile(join(tree, 'tracked'), 'staged preserved\n');
  await exec('git', ['add', 'tracked'], { cwd: tree });
  await writeFile(join(tree, 'untracked'), 'preserved\n');
  const indexPath = (
    await exec(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-path', 'index'],
      { cwd: tree },
    )
  ).stdout.trim();
  const before = await readFile(indexPath);
  const opts = {
    id: item.id,
    path: tree,
    branch: 'preserved',
    base: 'main',
    sessionId: 'preserved-claude-uuid',
  };
  const first = await run(ctx(root), 'adopt', opts);
  expect(first.isError, first.output).toBeFalsy();
  expect((await run(ctx(tree), 'adopt', opts)).isError).toBeFalsy();
  expect(await readFile(indexPath)).toEqual(before);
  expect(await readFile(join(tree, 'untracked'), 'utf8')).toBe('preserved\n');
  expect(
    (
      await exec('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: tree })
    ).stdout.trim(),
  ).toBe('preserved');
  expect(
    JSON.parse((await run(ctx(tree), 'show', { id: item.id })).output)
      .worktree_adoption.sessionId,
  ).toBe(opts.sessionId);
  expect(
    (await run(ctx(root), 'adopt', { ...opts, sessionId: 'replacement' }))
      .isError,
  ).toBe(true);
  expect(
    (await run(ctx(root), 'adopt', { ...opts, branch: 'wrong' })).isError,
  ).toBe(true);
  expect(
    (await run(ctx(root), 'adopt', { ...opts, base: 'missing-ref' })).isError,
  ).toBe(true);
  const other = await fixture();
  expect(
    (
      await run(ctx(root), 'adopt', {
        ...opts,
        path: other.tree,
        projectRoot: other.root,
      })
    ).isError,
  ).toBe(true);
  expect(
    (await run(ctx(root), 'adopt', { ...opts, path: other.tree })).isError,
  ).toBe(true);
});

it('serializes independent CLI processes and MCP writers against one shared store', async () => {
  const { root, tree } = await fixture();
  const item = await sealed(ctx(root));
  expect((await run(ctx(root), 'claim', { id: item.id })).isError).toBeFalsy();
  const server = createCodeKgMcpServer(ctx(tree));
  const client = new Client({ name: 'shared-store-proof', version: '1' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const results = await Promise.all([
      ...Array.from({ length: 12 }, (_, i) =>
        exec(process.execPath, [
          cli,
          '--dir',
          i % 2 ? tree : root,
          'work',
          'create',
          `process-${i}`,
          '--json',
        ]),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        client.callTool({
          name: 'codekg_work_verify',
          arguments: {
            id: item.id,
            verdict: 'pass',
            summary: `mcp-${i}`,
            json: true,
          },
        }),
      ),
    ]);
    expect(results).toHaveLength(20);
    const items = JSON.parse((await run(ctx(tree), 'list')).output);
    expect(items).toHaveLength(13);
    const stored = JSON.parse(
      (await run(ctx(root), 'show', { id: item.id })).output,
    );
    expect(stored.verifications).toHaveLength(8);
    expect(new Set(items.map((entry: { id: string }) => entry.id)).size).toBe(
      13,
    );
    expect(
      (await readFile(join(root, '.code-kg/work/items.jsonl'), 'utf8'))
        .trim()
        .split('\n'),
    ).toHaveLength(13);
  } finally {
    await client.close();
    await server.close();
  }
}, 30_000);

it('binds worker mutations and independent review to host authority/current seal; raw MCP and CLI fail closed', async () => {
  const { root } = await fixture();
  const c = ctx(root);
  const item = await sealed(c);
  const opts = { id: item.id };
  await writeFile(
    join(root, '.code-kg/work/admission.json'),
    JSON.stringify({ requireAuthority: true }),
  );
  const worker = {
    ...c,
    workAuthority: {
      actor: 'worker-a',
      role: 'worker' as const,
      workId: item.id,
      sealedRevision: item.interview.revision,
    },
  };
  const reviewer = {
    ...c,
    workAuthority: {
      actor: 'reviewer',
      role: 'reviewer' as const,
      workId: item.id,
      sealedRevision: item.interview.revision,
    },
  };
  expect((await run(c, 'claim', opts)).isError).toBe(true);
  expect((await run(worker, 'claim', opts)).isError).toBeFalsy();
  expect(
    (
      await run(
        {
          ...worker,
          workAuthority: { ...worker.workAuthority, sealedRevision: 'stale' },
        },
        'verify',
        { ...opts, verdict: 'pass', summary: 'stale' },
      )
    ).isError,
  ).toBe(true);
  expect((await run(worker, 'close', { ...opts, force: true })).isError).toBe(
    true,
  );
  expect(
    (await run(worker, 'accept', { ...opts, criterion: 'change' })).isError,
  ).toBe(true);
  expect(
    (
      await run(worker, 'verify', {
        ...opts,
        verdict: 'pass',
        summary: 'worker result',
      })
    ).isError,
  ).toBeFalsy();
  expect((await run(reviewer, 'close', opts)).isError).toBe(true);
  expect(
    (
      await run(reviewer, 'verify', {
        ...opts,
        verdict: 'pass',
        summary: 'independent check',
      })
    ).isError,
  ).toBeFalsy();
  expect((await run(reviewer, 'close', opts)).isError).toBeFalsy();
  expect(JSON.parse((await run(c, 'show', opts)).output).closed_by).toBe(
    'reviewer',
  );
  await expect(
    exec(
      process.execPath,
      [cli, '--dir', root, 'work', 'close', item.id, '--force'],
      { env: { ...process.env, CODEKG_AGENT_ROLE: 'orchestrator' } },
    ),
  ).rejects.toMatchObject({ code: 1 });
  const server = createCodeKgMcpServer(c);
  const client = new Client({ name: 'untrusted', version: '1' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  await client.connect(ct);
  try {
    expect(
      (
        await client.callTool({
          name: 'codekg_work_close',
          arguments: { id: item.id, force: true },
        })
      ).isError,
    ).toBe(true);
  } finally {
    await client.close();
    await server.close();
  }
  const operator = {
    ...c,
    workAuthority: { actor: 'operator', role: 'operator' as const },
  };
  expect(
    (await run(operator, 'close', { ...opts, force: true })).isError,
  ).toBeFalsy();
  expect(
    JSON.parse((await run(c, 'show', opts)).output).close_override_by,
  ).toBe('operator');
});

it('refuses to silently discard a legacy worktree-local store', async () => {
  const { root, tree } = await fixture();
  await sealed(ctx(root));
  await mkdir(join(tree, '.code-kg/work'), { recursive: true });
  await writeFile(join(tree, '.code-kg/work/items.jsonl'), '{"id":"legacy"}\n');
  const result = await run(ctx(tree), 'create', { title: 'must not diverge' });
  expect(result.isError).toBe(true);
  expect(result.output).toContain('explicit reconciliation');
  expect(JSON.parse((await run(ctx(root), 'list')).output)).toHaveLength(1);
});

it('rejects old verification after a reopened assignment is resealed', async () => {
  const { root } = await fixture();
  const c = ctx(root);
  const item = await sealed(c);
  const id = item.id;
  expect((await run(c, 'claim', { id })).isError).toBeFalsy();
  expect(
    (await run(c, 'verify', { id, verdict: 'pass', summary: 'Old scope only' }))
      .isError,
  ).toBeFalsy();
  expect((await run(c, 'update', { id, status: 'open' })).isError).toBeFalsy();
  expect(
    (await run(c, 'interview', { id, refresh: true })).isError,
  ).toBeFalsy();
  expect(
    (await run(c, 'accept', { id, criterion: 'New scope' })).isError,
  ).toBeFalsy();
  const resealed = JSON.parse((await run(c, 'seal', { id })).output);
  expect(resealed.interview.revision).not.toBe(item.interview.revision);
  expect((await run(c, 'claim', { id })).isError).toBeFalsy();
  expect((await run(c, 'close', { id })).output).toContain(
    'different sealed revision',
  );
});

it('does not commit a half evidence pair after a nested operation refuses', async () => {
  const { root } = await fixture();
  const item = await sealed(ctx(root));
  await writeFile(join(root, 'before.txt'), 'before');
  const failed = await run(ctx(root), 'evidence_pair', {
    id: item.id,
    before: 'before.txt',
    after: 'absent.txt',
  });
  expect(failed.isError).toBe(true);
  expect(
    JSON.parse((await run(ctx(root), 'show', { id: item.id })).output).evidence,
  ).toEqual([]);
});

it('seeds missing graph prerequisites then executes the full post-checkout hook; preserves failed checkout', async () => {
  const { root } = await fixture();
  const hooks = join(root, 'code-kg-composed-hooks');
  await mkdir(hooks);
  await mkdir(join(root, 'lat.md'));
  await mkdir(join(root, '.code-kg'), { recursive: true });
  await writeFile(join(root, 'lat.md/source.md'), '# Curated graph');
  await writeFile(join(root, '.code-kg/materialization-manifest.json'), '{}');
  await writeFile(
    join(hooks, 'post-checkout'),
    '#!/bin/sh\nset -eu\ntest -f lat.md/source.md\ntest -f .code-kg/materialization-manifest.json\ntest "$3" = 1\nprintf "hook executed" > hook-proof\n',
  );
  await chmod(join(hooks, 'post-checkout'), 0o755);
  await exec('git', ['config', 'core.hooksPath', hooks], { cwd: root });
  const item = await sealed(ctx(root), 'creation hook proof');
  const result = await run(ctx(root), 'isolate', { id: item.id });
  expect(result.isError, result.output).toBeFalsy();
  const tree = JSON.parse(result.output).worktree.path;
  expect(await readFile(join(tree, 'hook-proof'), 'utf8')).toBe(
    'hook executed',
  );
  expect(await readFile(join(tree, 'tracked'), 'utf8')).toBe('original\n');
  await writeFile(join(hooks, 'post-checkout'), '#!/bin/sh\nexit 23\n');
  const failedItem = await sealed(ctx(root), 'failing creation hook');
  const failed = await run(ctx(root), 'isolate', { id: failedItem.id });
  expect(failed.isError).toBe(true);
  expect(failed.output).toContain('preserved for inspection/adoption');
  expect(
    JSON.parse((await run(ctx(root), 'show', { id: failedItem.id })).output)
      .worktree_path,
  ).toBeUndefined();
  expect(
    (await exec('git', ['worktree', 'list', '--porcelain'], { cwd: root }))
      .stdout,
  ).toContain('failing-creation-hook');
  await rm(join(hooks, 'post-checkout'));
  const missingItem = await sealed(ctx(root), 'missing required hook');
  const missing = await run(ctx(root), 'isolate', { id: missingItem.id });
  expect(missing.isError).toBe(true);
  expect(missing.output).toContain('preserved for inspection/adoption');
});

it('runs full bound worker CLI and stdio MCP without trusting model argv/env authority', async () => {
  const { root } = await fixture();
  const c = ctx(root);
  const item = await sealed(c);
  await mkdir(join(root, 'lat.md'));
  await writeFile(
    join(root, '.code-kg/work/admission.json'),
    '{"requireAuthority":true}',
  );
  const binding = {
    projectRoot: root,
    workAuthority: {
      actor: 'preserved-worker-session',
      role: 'worker',
      workId: item.id,
      sealedRevision: item.interview.revision,
    },
  };
  const cliModule = new URL('../dist/src/codekg/cli.js', import.meta.url).href;
  const mcpModule = new URL('../dist/src/codekg/mcp.js', import.meta.url).href;
  const boundCli = join(root, 'bound-cli.mjs');
  const boundMcp = join(root, 'bound-mcp.mjs');
  await writeFile(
    boundCli,
    `import { runCodeKgCli } from ${JSON.stringify(cliModule)}; await runCodeKgCli(${JSON.stringify(binding)});`,
  );
  await writeFile(
    boundMcp,
    `import { startCodeKgMcpServer } from ${JSON.stringify(mcpModule)}; await startCodeKgMcpServer(${JSON.stringify(binding)});`,
  );
  const claimed = await exec(
    process.execPath,
    [boundCli, 'work', 'claim', item.id, '--json'],
    { env: { ...process.env, CODEKG_AGENT_ROLE: 'operator' } },
  );
  expect(JSON.parse(claimed.stdout).assignee).toBe(binding.workAuthority.actor);
  const other = await fixture();
  await expect(
    exec(process.execPath, [
      boundCli,
      '--dir',
      other.root,
      'work',
      'claim',
      item.id,
    ]),
  ).rejects.toMatchObject({ code: 1 });
  await expect(
    exec(process.execPath, [boundCli, 'work', 'close', item.id, '--force'], {
      env: { ...process.env, CODEKG_AGENT_ROLE: 'operator' },
    }),
  ).rejects.toMatchObject({ code: 1 });
  const client = new Client({ name: 'preserved-worker', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [boundMcp],
    cwd: other.root,
    stderr: 'pipe',
  });
  await client.connect(transport);
  try {
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    expect(tools).toContain('codekg_search');
    expect(tools).toContain('codekg_work_seal');
    expect(tools).toContain('codekg_work_adopt');
    expect(
      (
        await client.callTool({
          name: 'codekg_work_verify',
          arguments: {
            id: item.id,
            verdict: 'pass',
            summary: 'Real bound stdio worker result',
            json: true,
          },
        })
      ).isError,
    ).toBeFalsy();
    expect(
      (
        await client.callTool({
          name: 'codekg_work_close',
          arguments: { id: item.id, force: true },
        })
      ).isError,
    ).toBe(true);
    const stored = JSON.parse((await run(c, 'show', { id: item.id })).output);
    expect(stored.verifications.at(-1).actor).toBe(binding.workAuthority.actor);
    expect(stored.status).toBe('in_progress');
  } finally {
    await client.close();
  }
}, 30_000);

it('refuses open result/evidence/closure through bound CLI and MCP, then admits the started lifecycle and explicit operator force', async () => {
  const { root } = await fixture();
  const c = ctx(root);
  const item = await sealed(c, 'must start before results');
  const overrideItem = await sealed(c, 'explicit operator disposition');
  await mkdir(join(root, 'lat.md'));
  await writeFile(
    join(root, '.code-kg/work/admission.json'),
    '{"requireAuthority":true}',
  );
  const id = item.id;
  const authority = (role: 'worker' | 'reviewer' | 'operator') => ({
    actor: `bound-${role}`,
    role,
    workId: id,
    sealedRevision: item.interview.revision,
  });
  const cliModule = new URL('../dist/src/codekg/cli.js', import.meta.url).href;
  const mcpModule = new URL('../dist/src/codekg/mcp.js', import.meta.url).href;
  const workerCli = join(root, 'worker-cli.mjs');
  const reviewerMcp = join(root, 'reviewer-mcp.mjs');
  const workerMcp = join(root, 'worker-mcp.mjs');
  await writeFile(
    workerCli,
    `import { runCodeKgCli } from ${JSON.stringify(cliModule)}; await runCodeKgCli(${JSON.stringify({ projectRoot: root, workAuthority: authority('worker') })});`,
  );
  for (const [role, path] of [
    ['worker', workerMcp],
    ['reviewer', reviewerMcp],
  ] as const) {
    await writeFile(
      path,
      `import { startCodeKgMcpServer } from ${JSON.stringify(mcpModule)}; await startCodeKgMcpServer(${JSON.stringify({ projectRoot: root, workAuthority: authority(role) })});`,
    );
  }
  await writeFile(join(root, 'before.txt'), 'real before fixture');
  await writeFile(join(root, 'after.txt'), 'real after fixture');
  for (const args of [
    ['work', 'verify', id, '--verdict', 'pass', '--summary', 'Never started'],
    [
      'work',
      'evidence',
      'attach',
      id,
      '--kind',
      'after',
      '--path',
      join(root, 'after.txt'),
    ],
    [
      'work',
      'evidence',
      'pair',
      id,
      '--before',
      join(root, 'before.txt'),
      '--after',
      join(root, 'after.txt'),
    ],
  ]) {
    await expect(
      exec(process.execPath, [workerCli, ...args]),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Start or claim'),
    });
  }
  const workerClient = new Client({ name: 'open-worker-result', version: '1' });
  const reviewerClient = new Client({
    name: 'open-reviewer-result',
    version: '1',
  });
  await workerClient.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [workerMcp],
      stderr: 'pipe',
    }),
  );
  await reviewerClient.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [reviewerMcp],
      stderr: 'pipe',
    }),
  );
  try {
    const verifyArgs = {
      id,
      verdict: 'pass',
      summary: 'Result submitted through actual stdio',
      json: true,
    };
    expect(
      (
        await workerClient.callTool({
          name: 'codekg_work_verify',
          arguments: verifyArgs,
        })
      ).isError,
    ).toBe(true);
    expect(
      (
        await reviewerClient.callTool({
          name: 'codekg_work_verify',
          arguments: verifyArgs,
        })
      ).isError,
    ).toBe(true);
    expect(
      (
        await reviewerClient.callTool({
          name: 'codekg_work_close',
          arguments: { id },
        })
      ).isError,
    ).toBe(true);
    let stored = JSON.parse((await run(c, 'show', { id })).output);
    expect(stored.status).toBe('open');
    expect(stored.verifications).toEqual([]);
    expect(stored.evidence).toEqual([]);
    expect(
      (
        await run({ ...c, workAuthority: authority('operator') }, 'close', {
          id: overrideItem.id,
        })
      ).isError,
    ).toBe(true);
    expect(
      (
        await run({ ...c, workAuthority: authority('operator') }, 'close', {
          id: overrideItem.id,
          force: true,
        })
      ).isError,
    ).toBeFalsy();
    expect(
      JSON.parse((await run(c, 'show', { id: overrideItem.id })).output)
        .close_override_by,
    ).toBe('bound-operator');
    await exec(process.execPath, [workerCli, 'work', 'claim', id]);
    await exec(process.execPath, [
      workerCli,
      'work',
      'evidence',
      'pair',
      id,
      '--before',
      join(root, 'before.txt'),
      '--after',
      join(root, 'after.txt'),
    ]);
    expect(
      (
        await workerClient.callTool({
          name: 'codekg_work_verify',
          arguments: verifyArgs,
        })
      ).isError,
    ).toBeFalsy();
    expect(
      (
        await reviewerClient.callTool({
          name: 'codekg_work_verify',
          arguments: verifyArgs,
        })
      ).isError,
    ).toBeFalsy();
    expect(
      (
        await reviewerClient.callTool({
          name: 'codekg_work_close',
          arguments: { id },
        })
      ).isError,
    ).toBeFalsy();
    stored = JSON.parse((await run(c, 'show', { id })).output);
    expect(stored.status).toBe('closed');
    expect(stored.closed_by).toBe('bound-reviewer');
  } finally {
    await workerClient.close();
    await reviewerClient.close();
  }
}, 30_000);
