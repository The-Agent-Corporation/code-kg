import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createCodeKgMcpServer } from '../src/codekg/mcp.js';
import { trace, traceCommand } from '../src/codekg/query.js';
import { plainStyler, type CmdContext } from '../src/context.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function chain(mode: CmdContext['mode']): Promise<CmdContext> {
  const root = await mkdtemp(join(tmpdir(), 'codekg-trace-depth-'));
  roots.push(root);
  await mkdir(join(root, 'src'));
  await writeFile(
    join(root, 'src/a.ts'),
    'export function leaf() { return 1; }\n',
  );
  await writeFile(
    join(root, 'src/b.ts'),
    "import { leaf } from './a.js';\nexport function middle() { return leaf(); }\n",
  );
  await writeFile(
    join(root, 'src/c.ts'),
    "import { middle } from './b.js';\nexport function top() { return middle(); }\n",
  );
  return {
    projectRoot: root,
    latDir: join(root, 'lat.md'),
    styler: plainStyler,
    mode,
  };
}

async function callTrace(ctx: CmdContext, args: Record<string, unknown>) {
  const server = createCodeKgMcpServer(ctx);
  const client = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    const response = await client.callTool({
      name: 'codekg_trace_calls',
      arguments: args,
    });
    return (response.content as { text: string }[])[0].text;
  } finally {
    await client.close();
    await server.close();
  }
}

describe('trace depth', () => {
  it('reports when results exist beyond the default MCP depth', async () => {
    const ctx = await chain('mcp');

    const direct = await callTrace(ctx, { query: 'leaf' });
    const all = await callTrace(ctx, { query: 'leaf', depth: 'all' });

    expect(direct).toContain(
      'Depth: 1 (more results beyond this depth; call again with depth: "all" for transitive results)',
    );
    expect(direct).toContain('- middle |');
    expect(direct).not.toContain('- top |');
    expect(all).toContain('Depth: all\n');
    expect(all).toContain('- top |');
  });

  it('gives the CLI flag in the hint and no hint when nothing is cut off', async () => {
    const ctx = await chain('cli');

    const direct = await traceCommand(ctx, 'leaf', { depth: 1 });
    const enough = await traceCommand(ctx, 'leaf', { depth: 2 });

    expect(direct.output).toContain('rerun with --depth all');
    expect(enough.output).toContain('Depth: 2\n');
    expect((await trace(ctx.projectRoot, 'leaf', { depth: 2 })).truncated).toBe(
      false,
    );
  });
});
