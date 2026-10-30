import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { codeKgCheckCommand } from '../src/codekg/check.js';
import { createCodeKgMcpServer } from '../src/codekg/mcp.js';
import { plainStyler, type CmdContext } from '../src/context.js';

const roots: string[] = [];
const cliPath = join(
  import.meta.dirname,
  '..',
  'dist',
  'src',
  'codekg',
  'cli.js',
);

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

describe('Code-KG user-facing messages', () => {
  it('check suggests code-kg commands rather than lat init', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', await tempDir('codekg-config-'));
    for (const name of [
      'LAT_EMBEDDING_PROVIDER',
      'LAT_LLM_KEY',
      'LAT_LLM_KEY_FILE',
      'LAT_LLM_KEY_HELPER',
    ]) {
      vi.stubEnv(name, undefined);
    }
    const root = await tempDir('codekg-messages-');
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src', 'index.ts'), 'export const a = 1;\n');
    await writeBootstrapPlan(await createBootstrapPlan(root));
    const ctx: CmdContext = {
      latDir: join(root, 'lat.md'),
      projectRoot: root,
      styler: plainStyler,
      mode: 'cli',
    };

    const result = await codeKgCheckCommand(ctx);

    expect(result.isError).toBeFalsy();
    expect(result.output).not.toContain('lat init');
    expect(result.output).not.toContain('No init version recorded');
    expect(result.output).toContain('code-kg semantic enable-local');
  });

  it('section output names Code-KG commands and MCP tools', async () => {
    const root = await tempDir('codekg-section-hints-');
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src', 'index.ts'), 'export const a = 1;\n');
    await writeBootstrapPlan(await createBootstrapPlan(root));
    const ctx: CmdContext = {
      latDir: join(root, 'lat.md'),
      projectRoot: root,
      styler: plainStyler,
      mode: 'mcp',
    };
    const server = createCodeKgMcpServer(ctx);
    const client = new Client({ name: 'test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    await client.connect(b);
    let mcpText: string;
    try {
      const response = await client.callTool({
        name: 'codekg_section',
        arguments: { query: 'lat.md/architecture#Architecture' },
      });
      mcpText = (response.content as { text: string }[])[0].text;
    } finally {
      await client.close();
      await server.close();
    }

    const { stdout } = await promisify(execFile)(
      process.execPath,
      [cliPath, 'section', 'lat.md/architecture#Architecture'],
      { cwd: root },
    );

    expect(mcpText).toContain('`codekg_section`');
    expect(mcpText).not.toContain('lat_section');
    expect(stdout).toContain('`code-kg section "section#id"`');
    expect(stdout).not.toContain('`lat section');
  });

  it('suggests code-kg bootstrap when lat.md/ is missing', async () => {
    const root = await tempDir('codekg-no-lat-');

    const run = promisify(execFile)(process.execPath, [cliPath, 'check'], {
      cwd: root,
    });

    await expect(run).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(
        'Run `code-kg bootstrap --accept` to create one.',
      ),
    });
  });
});
