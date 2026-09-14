import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { plainStyler, type CmdContext } from '../src/context.js';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import { createCodeKgMcpServer } from '../src/codekg/mcp.js';
import { agentsCommand } from '../src/codekg/agents.js';
import {
  workAcceptCommand,
  workAnswerCommand,
  workClaimCommand,
  workCleanupCommand,
  workCloseCommand,
  workCreateCommand,
  workDepCommand,
  workEvidenceListCommand,
  workEvidencePairCommand,
  workInitCommand,
  workInterviewCommand,
  workIsolateCommand,
  workPrimeCommand,
  workReadyCommand,
  workSealCommand,
  workSessionSummary,
  workStartCommand,
  workVerifyCommand,
} from '../src/codekg/work.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function initGitRepo(root: string): Promise<void> {
  await execFileAsync('git', ['init'], { cwd: root });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], {
    cwd: root,
  });
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: root });
  await execFileAsync('git', ['add', '.'], { cwd: root });
  await execFileAsync('git', ['commit', '-m', 'init'], { cwd: root });
  await execFileAsync('git', ['branch', '-M', 'main'], { cwd: root });
}
const roots: string[] = [];

async function makeProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'codekg-work-'));
  roots.push(root);
  await mkdir(join(root, 'src'), { recursive: true });
  await mkdir(join(root, 'tests'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'demo', main: 'src/index.ts' }, null, 2),
  );
  await writeFile(
    join(root, 'src', 'util.ts'),
    'export function makeValue() {\n  return 1;\n}\n',
  );
  await writeFile(
    join(root, 'src', 'index.ts'),
    'import { makeValue } from "./util";\n\nexport const value = makeValue();\n',
  );
  await writeFile(
    join(root, 'tests', 'index.test.ts'),
    'import "../src/index";\n',
  );
  return root;
}

function ctx(root: string): CmdContext {
  return {
    latDir: join(root, 'lat.md'),
    projectRoot: root,
    styler: plainStyler,
    mode: 'cli',
  };
}

function firstText(result: Awaited<ReturnType<Client['callTool']>>): string {
  return (result.content as { type: string; text: string }[])[0].text;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('code-kg work tracker', () => {
  it('tracks ready work, blockers, claim/close, and persists jsonl', async () => {
    const root = await makeProject();
    const c = ctx(root);

    await workInitCommand(c);
    const parent = await workCreateCommand(c, {
      title: 'Ship work tracker',
      priority: 1,
      json: true,
    });
    const parentId = JSON.parse(parent.output).id as string;

    const blocked = await workCreateCommand(c, {
      title: 'Write docs',
      deps: [parentId],
      json: true,
    });
    const blockedId = JSON.parse(blocked.output).id as string;

    const ready = await workReadyCommand(c, { json: true });
    const readyIds = (JSON.parse(ready.output) as Array<{ id: string }>).map(
      (item) => item.id,
    );
    expect(readyIds).toContain(parentId);
    expect(readyIds).not.toContain(blockedId);

    const claimBlocked = await workClaimCommand(c, { id: blockedId });
    expect(claimBlocked.isError).toBe(true);
    expect(claimBlocked.output).toContain('blocked');

    await workClaimCommand(c, { id: parentId, assignee: 'tester' });
    const blockedClose = await workCloseCommand(c, {
      id: parentId,
      reason: 'done',
    });
    expect(blockedClose.isError).toBe(true);
    expect(blockedClose.output).toContain('verification');

    await workVerifyCommand(c, {
      id: parentId,
      verdict: 'pass',
      summary: 'Ready items unlock and claim gates work',
      method: 'test',
      check: ['ready-gate:pass'],
    });
    await workCloseCommand(c, { id: parentId, reason: 'done' });

    const readyAfter = await workReadyCommand(c, { json: true });
    const readyAfterIds = (
      JSON.parse(readyAfter.output) as Array<{ id: string }>
    ).map((item) => item.id);
    expect(readyAfterIds).toContain(blockedId);

    const stored = await readFile(
      join(root, '.code-kg', 'work', 'items.jsonl'),
      'utf8',
    );
    expect(stored).toContain(parentId);
    expect(stored).toContain('"status":"closed"');
  });

  it('links discovered work and primes start with knowledge when bootstrapped', async () => {
    const root = await makeProject();
    await writeBootstrapPlan(await createBootstrapPlan(root));
    const c = ctx(root);

    const created = await workCreateCommand(c, {
      title: 'entry points',
      queries: ['entry points'],
      json: true,
    });
    const id = JSON.parse(created.output).id as string;

    const discovered = await workCreateCommand(c, {
      title: 'Follow-up cleanup',
      discoveredFrom: id,
      json: true,
    });
    expect(JSON.parse(discovered.output).deps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id, kind: 'discovered-from' }),
      ]),
    );

    const discoveredId = JSON.parse(discovered.output).id as string;
    await workDepCommand(c, { id: discoveredId, related: id });

    const started = await workStartCommand(c, { id, json: true });
    expect(started.isError).toBeFalsy();
    const payload = JSON.parse(started.output) as {
      item: { status: string; context_cache?: string };
      usedGraph: boolean;
    };
    expect(payload.item.status).toBe('in_progress');
    expect(payload.usedGraph).toBe(true);
    expect(payload.item.context_cache).toBeTruthy();

    const prime = await workPrimeCommand(c);
    expect(prime.output).toContain('Code-KG Work Prime');
    expect(prime.output).toContain(id);

    const summary = await workSessionSummary(root);
    expect(summary).toContain('in_progress');
    expect(summary).toContain(id);
  });

  it('installs work-tracker guidance into AGENTS.md', async () => {
    const root = await makeProject();
    await writeBootstrapPlan(await createBootstrapPlan(root));
    const result = await agentsCommand(ctx(root), { action: 'install' });
    expect(result.isError).toBeFalsy();
    const agentsMd = await readFile(join(root, 'AGENTS.md'), 'utf-8');
    expect(agentsMd).toContain('code-kg work');
    expect(agentsMd).toContain('work start');
    expect(agentsMd).toContain('--worktree');
    expect(agentsMd).toContain('evidence pair');
    expect(agentsMd).toContain('code-structure');
    expect(agentsMd).toContain('--discovered-from');
    expect(agentsMd).toContain('work verify');
    expect(agentsMd).toContain('work interview');
    expect(agentsMd).toContain('anti-slop-code');
    expect(agentsMd).toContain('ui-skills-route');
  });

  it('interviews, seals, verifies, and gates close', async () => {
    const root = await makeProject();
    const c = ctx(root);
    await workInitCommand(c);

    const created = await workCreateCommand(c, {
      title: 'Improve search somehow',
      json: true,
    });
    const id = JSON.parse(created.output).id as string;
    expect(JSON.parse(created.output).interview.questions.length).toBeGreaterThan(
      0,
    );

    const interview = await workInterviewCommand(c, { id, json: true });
    const questions = JSON.parse(interview.output).questions as Array<{
      id: string;
      prompt: string;
    }>;
    for (const question of questions) {
      await workAnswerCommand(c, {
        id,
        question: question.id,
        answer: `Answer for ${question.id}`,
      });
    }
    await workAcceptCommand(c, {
      id,
      criterion: 'search returns seeded hit',
    });
    const sealed = await workSealCommand(c, { id, json: true });
    expect(JSON.parse(sealed.output).interview.sealed_at).toBeTruthy();

    const failClose = await workCloseCommand(c, { id, reason: 'nope' });
    expect(failClose.isError).toBe(true);

    await workVerifyCommand(c, {
      id,
      verdict: 'fail',
      summary: 'search still broken',
      method: 'runtime',
    });
    const failStill = await workCloseCommand(c, { id, reason: 'nope' });
    expect(failStill.isError).toBe(true);
    expect(failStill.output).toContain('fail');

    await workVerifyCommand(c, {
      id,
      verdict: 'pass',
      summary: 'search returns seeded hit',
      method: 'runtime',
      check: ['search returns seeded hit:pass'],
    });
    const closed = await workCloseCommand(c, { id, reason: 'verified' });
    expect(closed.isError).toBeFalsy();
    expect(closed.output).toContain('Closed');
  });

  it('exposes work tools over MCP', async () => {
    const root = await makeProject();
    await writeBootstrapPlan(await createBootstrapPlan(root));
    const server = createCodeKgMcpServer({ ...ctx(root), mode: 'mcp' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'codekg-work-test', version: '0.1.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name);
      expect(names).toContain('codekg_work_ready');
      expect(names).toContain('codekg_work_start');
      expect(names).toContain('codekg_work_prime');
      expect(names).toContain('codekg_work_verify');
      expect(names).toContain('codekg_work_interview');
      expect(names).toContain('codekg_work_seal');

      const created = await client.callTool({
        name: 'codekg_work_create',
        arguments: { title: 'MCP task', json: true },
      });
      const id = JSON.parse(firstText(created)).id as string;

      const ready = await client.callTool({
        name: 'codekg_work_ready',
        arguments: { json: true },
      });
      expect(firstText(ready)).toContain(id);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('isolates work into a git worktree and cleans it up', async () => {
    const root = await makeProject();
    await initGitRepo(root);
    const c = ctx(root);
    await workInitCommand(c);
    const created = await workCreateCommand(c, {
      title: 'Isolate me',
      json: true,
    });
    const id = JSON.parse(created.output).id as string;

    const isolated = await workIsolateCommand(c, { id, json: true });
    expect(isolated.isError).toBeFalsy();
    const payload = JSON.parse(isolated.output) as {
      item: { worktree_path?: string; worktree_branch?: string };
    };
    expect(payload.item.worktree_path).toBeTruthy();
    expect(payload.item.worktree_branch).toMatch(/^agent\//);

    const cleanup = await workCleanupCommand(c, { id, force: true, json: true });
    expect(cleanup.isError).toBeFalsy();
    expect(JSON.parse(cleanup.output).worktree_path).toBeUndefined();
  });

  it('stores before/after evidence pairs on a work item', async () => {
    const root = await makeProject();
    const c = ctx(root);
    await workInitCommand(c);
    const created = await workCreateCommand(c, {
      title: 'Prove the fix',
      json: true,
    });
    const id = JSON.parse(created.output).id as string;
    const before = join(root, 'before.txt');
    const after = join(root, 'after.txt');
    await writeFile(before, 'broken');
    await writeFile(after, 'fixed');

    const paired = await workEvidencePairCommand(c, {
      id,
      before,
      after,
      label: 'banner',
      json: true,
    });
    expect(paired.isError).toBeFalsy();
    const list = await workEvidenceListCommand(c, { id, json: true });
    const evidence = JSON.parse(list.output) as Array<{ kind: string }>;
    expect(evidence.some((entry) => entry.kind === 'before')).toBe(true);
    expect(evidence.some((entry) => entry.kind === 'after')).toBe(true);
    expect(evidence.some((entry) => entry.kind === 'pair')).toBe(true);
  });
});
