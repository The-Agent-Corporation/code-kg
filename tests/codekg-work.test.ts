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
  workClaimCommand,
  workCloseCommand,
  workCreateCommand,
  workDepCommand,
  workInitCommand,
  workPrimeCommand,
  workReadyCommand,
  workSessionSummary,
  workStartCommand,
} from '../src/codekg/work.js';

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
    expect(agentsMd).toContain('--discovered-from');
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
});
