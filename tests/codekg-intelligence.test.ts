import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  unlink,
  symlink,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { plainStyler, type CmdContext } from '../src/context.js';
import { freshGraph } from '../src/codekg/fresh.js';
import { extractProjectGraph, hashProjectGraph } from '../src/codekg/graph.js';
import { extractionStats } from '../src/codekg/structural.js';
import {
  ask,
  formatQuery,
  trace,
  mapCommand,
  skeletonCommand,
  grepCommand,
  bounded,
} from '../src/codekg/query.js';
import {
  createBootstrapPlan,
  writeBootstrapPlan,
} from '../src/codekg/bootstrap.js';
import { driftCommand } from '../src/codekg/drift.js';
import {
  currentMeanings,
  enrichSourcesCommand,
} from '../src/codekg/meaning.js';
import { reviewSourceCommand } from '../src/codekg/review-source.js';
import { agentContextCommand } from '../src/codekg/agent-context.js';
import { agentsCommand } from '../src/codekg/agents.js';
import { createCodeKgMcpServer } from '../src/codekg/mcp.js';
import { askWorkspace, workspaceCommand } from '../src/codekg/workspace.js';
import { readJson, writeJsonAtomic } from '../src/codekg/cache.js';
import type { MaterializationManifest } from '../src/codekg/types.js';

const roots: string[] = [];
function ctx(root: string): CmdContext {
  return {
    projectRoot: root,
    latDir: join(root, 'lat.md'),
    styler: plainStyler,
    mode: 'cli',
  };
}
async function fixture(mapped = false) {
  const root = await mkdtemp(join(tmpdir(), 'codekg-intelligence-'));
  roots.push(root);
  await mkdir(join(root, 'src'));
  await writeFile(
    join(root, 'src/math.ts'),
    'export function add(a: number, b: number) { return a + b; }\n',
  );
  await writeFile(
    join(root, 'src/app.ts'),
    "import { add } from './math.js';\nexport function calculate() { return add(2, 3); }\n",
  );
  if (mapped) await writeBootstrapPlan(await createBootstrapPlan(root));
  return root;
}
const manifestPath = (root: string) =>
  join(root, '.code-kg/materialization-manifest.json');
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

describe('fresh structural intelligence', () => {
  it('resolves ESM .js imports to TypeScript and traces calls both ways', async () => {
    const root = await fixture();
    const graph = await freshGraph(root);
    expect(graph.analysis.parse_errors).toEqual([]);
    expect(graph.edges.some((e) => e.relation === 'calls')).toBe(true);
    expect((await trace(root, 'add')).hits.map((h) => h.node.label)).toContain(
      'calculate',
    );
    expect(
      (await trace(root, 'calculate', { direction: 'out' })).hits.map(
        (h) => h.node.label,
      ),
    ).toContain('add');
  });
  it('reuses unchanged parsing, invalidates edits and deletions, and preserves symbol identity', async () => {
    const root = await fixture();
    const before = await freshGraph(root);
    expect(extractionStats(root)).toEqual({ parsed: 2, reused: 0 });
    await freshGraph(root);
    expect(extractionStats(root)).toEqual({ parsed: 0, reused: 2 });
    await writeFile(
      join(root, 'src/math.ts'),
      'export function add(a: number, b: number) { return a - b; }\n',
    );
    const after = await freshGraph(root);
    expect(extractionStats(root)).toEqual({ parsed: 1, reused: 1 });
    expect(hashProjectGraph(after)).not.toBe(hashProjectGraph(before));
    expect(after.nodes.find((n) => n.label === 'add')?.id).toBe(
      before.nodes.find((n) => n.label === 'add')?.id,
    );
    await unlink(join(root, 'src/math.ts'));
    expect((await freshGraph(root)).nodes.some((n) => n.label === 'add')).toBe(
      false,
    );
    expect(
      (await trace(root, 'calculate', { direction: 'out' })).hits.some(
        (h) => h.node.label === 'add',
      ),
    ).toBe(false);
  });
  it('keeps extraction previews disk read-only and coalesces concurrent refreshes', async () => {
    const root = await fixture();
    await extractProjectGraph(root);
    expect(existsSync(join(root, '.code-kg'))).toBe(false);
    const [a, b] = await Promise.all([freshGraph(root), freshGraph(root)]);
    expect(a).toBe(b);
    expect(existsSync(join(root, '.code-kg/cache/refresh.lock'))).toBe(false);
  });
  it('detects body-only drift without rewriting reviewed prose or accepting it', async () => {
    const root = await fixture(true);
    const manifest = (await readJson<MaterializationManifest>(
      manifestPath(root),
    ))!;
    manifest.sections.architecture.status = 'curated';
    await writeJsonAtomic(manifestPath(root), manifest);
    const path = join(root, manifest.sections.architecture.file);
    const prose = await readFile(path, 'utf8');
    const metadata = await readFile(manifestPath(root), 'utf8');
    await writeFile(
      join(root, 'src/math.ts'),
      'export function add(a: number, b: number) { return a - b; }\n',
    );
    await ask(root, 'architecture add', { semantic: false });
    const drift = await driftCommand(ctx(root), { applySafe: false });
    expect(drift.output).toMatch(/source content changed/i);
    expect(await readFile(path, 'utf8')).toBe(prose);
    expect(await readFile(manifestPath(root), 'utf8')).toBe(metadata);
    await reviewSourceCommand(ctx(root), 'architecture');
    expect(await readFile(manifestPath(root), 'utf8')).toBe(metadata);
    await reviewSourceCommand(ctx(root), 'architecture', true);
    expect(
      (await driftCommand(ctx(root), { applySafe: false })).output,
    ).not.toMatch(/source content changed/i);
    expect(await readFile(path, 'utf8')).toBe(prose);
  });
  it.each([
    ['example.py', 'def greet(name):\n    return name\n', 'greet'],
    [
      'Example.java',
      'class Example { public int greet() { return 1; } }',
      'Example',
    ],
    ['example.kt', 'fun greet(): Int { return 1 }', 'greet'],
    ['example.swift', 'func greet() -> Int { return 1 }', 'greet'],
    ['example.php', '<?php function greet() { return 1; }', 'greet'],
    ['example.r', 'greet <- function(x) { x + 1 }', 'greet'],
    ['example.rs', 'pub fn greet() -> i32 { 1 }', 'greet'],
    ['example.rb', 'def greet(name)\n  name\nend\n', 'greet'],
    ['example.cpp', 'int greet() { return 1; }', 'greet'],
    [
      'example.cs',
      'class Example { public int Greet() { return 1; } }',
      'Example',
    ],
    ['example.js', 'export function greet() { return 1; }', 'greet'],
    ['example.go', 'package main\nfunc greet() int { return 1 }', 'greet'],
    ['example.c', 'int greet() { return 1; }', 'greet'],
    ['example.scala', 'object Example { def greet(): Int = 1 }', 'Example'],
    [
      'example.ex',
      'defmodule Example do\n  def greet(), do: 1\nend',
      'Example',
    ],
    [
      'example.sol',
      'contract Example { function greet() public returns (uint) { return 1; } }',
      'Example',
    ],
    ['example.ml', 'let greet x = x + 1', 'greet'],
    ['example.zig', 'pub fn greet() i32 { return 1; }', 'greet'],
    ['example.dart', 'int greet() { return 1; }', 'greet'],
    ['example.clj', '(defn greet [] 1)', 'greet'],
    ['example.nix', '{ greet = x: x + 1; }', 'greet'],
    ['example.lua', 'function greet()\n  return 1\nend', 'greet'],
  ])(
    'extracts %s through its installed parser',
    async (file, source, symbol) => {
      const root = await fixture();
      await writeFile(join(root, 'src', file), source);
      const graph = await freshGraph(root);
      expect(graph.analysis.parse_errors).toEqual([]);
      expect(
        graph.nodes.some(
          (n) => n.source_file === 'src/' + file && n.label === symbol,
        ),
      ).toBe(true);
    },
  );
});

describe('agent retrieval', () => {
  it('rejects source symlinks escaping the repository', async () => {
    const root = await fixture(),
      external = await fixture();
    await symlink(join(external, 'src/math.ts'), join(root, 'src/external.ts'));
    const graph = await freshGraph(root);
    expect(graph.analysis.parse_errors.join('\n')).toContain(
      'source symlink escapes',
    );
    expect(graph.source_hashes?.['src/external.ts']).toBeUndefined();
  });
  it('combines knowledge with live source and respects bounds and scopes', async () => {
    const root = await fixture(true);
    const result = await ask(root, 'add calculate architecture', {
      semantic: false,
    });
    expect(result.hits.some((h) => h.kind === 'knowledge')).toBe(true);
    expect(
      result.hits.some((h) => h.kind === 'source' && h.text.includes('return')),
    ).toBe(true);
    expect(formatQuery(result, { maxTokens: 64 }).length).toBeLessThanOrEqual(
      256,
    );
    expect(
      (
        await ask(root, 'calculate', { semantic: false, in: 'src/math.ts' })
      ).hits
        .filter((h) => h.kind === 'source')
        .every((h) => h.path === 'src/math.ts'),
    ).toBe(true);
    await expect(ask(root, 'add', { in: '../elsewhere' })).rejects.toThrow(
      'project-relative',
    );
    expect(() => bounded('x', -1)).toThrow();
    expect(
      (await ask(root, 'zxqvunknowntoken', { semantic: false })).hits,
    ).toEqual([]);
  });
  it('respects rejected edges and suppressed file descendants in navigation', async () => {
    const root = await fixture(true);
    const graph = await freshGraph(root);
    const manifest = (await readJson<MaterializationManifest>(
      manifestPath(root),
    ))!;
    const call = graph.edges.find((e) => e.relation === 'calls')!;
    manifest.relationships[call.id] = { status: 'rejected' };
    await writeJsonAtomic(manifestPath(root), manifest);
    expect(
      (await trace(root, 'add')).hits.map((h) => h.node.label),
    ).not.toContain('calculate');
    manifest.suppressed.nodes.push(
      graph.nodes.find(
        (n) => n.kind === 'file' && n.source_file === 'src/math.ts',
      )!.id,
    );
    await writeJsonAtomic(manifestPath(root), manifest);
    expect(
      (await ask(root, 'add', { semantic: false })).hits
        .filter((h) => h.kind === 'source')
        .some((h) => h.path === 'src/math.ts'),
    ).toBe(false);
    expect((await skeletonCommand(ctx(root), 'math.ts')).isError).toBe(true);
    expect((await mapCommand(ctx(root))).output).not.toContain('src/math.ts');
  });
  it('provides file APIs and bounded symbol-attributed literal and regex search', async () => {
    const root = await fixture();
    expect((await skeletonCommand(ctx(root), 'math.ts')).output).toContain(
      'add',
    );
    expect((await grepCommand(ctx(root), 'return')).output).toContain('[add]');
    expect(
      (
        await grepCommand(ctx(root), 'ret.rn', {
          regex: true,
          in: 'src/math.ts',
        })
      ).output,
    ).toContain('1 matches in 1 indexed files');
  });
  it('never serves a stale inferred description after a same-symbol edit', async () => {
    const root = await fixture(true);
    const metadata = await readFile(manifestPath(root), 'utf8');
    const generate = vi.fn(async (file: string) =>
      file.includes('math')
        ? 'Adds two numbers. ObsoleteMeaningToken.'
        : 'Calculation entrypoint.',
    );
    await enrichSourcesCommand(ctx(root), { generate });
    expect(generate).toHaveBeenCalledTimes(2);
    await enrichSourcesCommand(ctx(root), { generate });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(
      (await ask(root, 'ObsoleteMeaningToken', { semantic: false })).hits
        .length,
    ).toBeGreaterThan(0);
    await writeFile(
      join(root, 'src/math.ts'),
      'export function add(a: number, b: number) { return a - b; }\n',
    );
    expect(
      (await ask(root, 'ObsoleteMeaningToken', { semantic: false })).hits,
    ).toEqual([]);
    const result = await ask(root, 'add', { semantic: false });
    expect(result.hits.some((h) => h.text.includes('return a - b'))).toBe(true);
    expect(
      (await currentMeanings(root, await freshGraph(root))).has('src/math.ts'),
    ).toBe(false);
    expect(await readFile(manifestPath(root), 'utf8')).toBe(metadata);
  });
  it('discards a summary when source changes during model generation and limits failed requests', async () => {
    const root = await fixture();
    const generate = vi.fn(async (file: string) => {
      await writeFile(
        join(root, file),
        'export function changedDuringRequest() {}\n',
      );
      return 'Old source meaning';
    });
    const result = await enrichSourcesCommand(ctx(root), {
      generate,
      limit: 1,
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(true);
    expect((await currentMeanings(root, await freshGraph(root))).size).toBe(0);
  });
  it('does not send a stored remote-provider credential to a custom local model', async () => {
    const root = await fixture();
    vi.stubEnv('LAT_LLM_KEY', 'sk-secret-for-elsewhere');
    vi.stubEnv('CODEKG_LLM_KEY', '');
    const mock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Source description' } }],
        }),
        { status: 200 },
      ),
    );
    await enrichSourcesCommand(ctx(root), {
      baseUrl: 'http://localhost:1234/v1',
      model: 'local',
      limit: 1,
    });
    expect(mock.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
  });
  it('supports fresh retrieval through MCP without changing legacy tools', async () => {
    const root = await fixture(true);
    const server = createCodeKgMcpServer(ctx(root));
    const client = new Client({ name: 'test', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    await client.connect(b);
    try {
      expect((await client.listTools()).tools.map((t) => t.name)).toEqual(
        expect.arrayContaining([
          'codekg_ask',
          'codekg_trace_calls',
          'codekg_search',
          'codekg_confidence',
        ]),
      );
      const response = await client.callTool({
        name: 'codekg_ask',
        arguments: { query: 'calculate', semantic: false, max_tokens: 400 },
      });
      expect(response.isError).not.toBe(true);
      expect(JSON.stringify(response.content)).toContain('calculate');
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe('agent lifecycle context', () => {
  it('federates only registered repositories and scopes them by name', async () => {
    const first = await fixture();
    const second = await fixture();
    await writeFile(
      join(second, 'src/app.ts'),
      'export function anotherCalculation() { return 9; }\n',
    );
    await workspaceCommand(ctx(first), 'add', [first, second]);
    const result = await askWorkspace(first, 'add', { semantic: false });
    expect(new Set(result.hits.map((h) => h.id.split('::')[0])).size).toBe(2);
    const name = second.split('/').pop()!;
    const scoped = await askWorkspace(first, 'anotherCalculation', {
      in: name + '/src',
      semantic: false,
    });
    expect(scoped.hits.every((h) => h.path.startsWith(name + '/src/'))).toBe(
      true,
    );
    await workspaceCommand(ctx(first), 'remove', [name]);
    expect(
      (await askWorkspace(first, 'anotherCalculation', { semantic: false }))
        .hits,
    ).toEqual([]);
  });
  it('stays silent outside mapped projects and on invalid input', async () => {
    const root = await fixture();
    expect((await agentContextCommand(ctx(root), 'session', '{}')).output).toBe(
      '',
    );
    expect((await agentContextCommand(ctx(root), 'prompt', 'bad')).output).toBe(
      '',
    );
  });
  it('deduplicates session context and refreshes after edits without touching knowledge', async () => {
    const root = await fixture(true);
    const metadata = await readFile(manifestPath(root), 'utf8');
    const payload = JSON.stringify({ session_id: 'session-1' });
    expect(
      (await agentContextCommand(ctx(root), 'session', payload)).output,
    ).toContain('additionalContext');
    expect(
      (await agentContextCommand(ctx(root), 'session', payload)).output,
    ).toBe('');
    expect(
      (
        await agentContextCommand(
          ctx(root),
          'prompt',
          JSON.stringify({ prompt: 'Where does calculate call add?' }),
        )
      ).output,
    ).toContain('calculate');
    expect(
      (
        await agentContextCommand(
          ctx(root),
          'edit',
          JSON.stringify({
            tool_input: { file_path: join(root, 'src/math.ts') },
          }),
        )
      ).output,
    ).toContain('calculate');
    expect((await agentContextCommand(ctx(root), 'stop', payload)).output).toBe(
      '',
    );
    expect(await readFile(manifestPath(root), 'utf8')).toBe(metadata);
  });

  it('blocks Stop once when code-kg check fails', async () => {
    const root = await fixture(true);
    // Corrupt the manifest so check fails while the KB remains present.
    const manifest = JSON.parse(await readFile(manifestPath(root), 'utf8'));
    manifest.version = 99;
    await writeFile(manifestPath(root), JSON.stringify(manifest, null, 2));
    const first = await agentContextCommand(
      ctx(root),
      'stop',
      JSON.stringify({ session_id: 'stop-block-1' }),
    );
    const parsed = JSON.parse(first.output);
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('code-kg check');

    const second = await agentContextCommand(
      ctx(root),
      'stop',
      JSON.stringify({ session_id: 'stop-block-1', stop_hook_active: true }),
    );
    expect(second.output).toBe(''); // Acknowledged Stop must not reinject feedback.
    expect(second.output).not.toContain('"decision":"block"');
  });
  it('installs and removes managed lifecycle hooks without deleting foreign hooks', async () => {
    const root = await fixture();
    await mkdir(join(root, '.codex'));
    const path = join(root, '.codex/hooks.json');
    await writeJsonAtomic(path, {
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo custom' }] }],
      },
    });
    await agentsCommand(ctx(root), { action: 'install' });
    await agentsCommand(ctx(root), { action: 'install' });
    const installed = await readJson<any>(path);
    expect(installed.hooks.Stop).toHaveLength(2);
    expect(installed.hooks.UserPromptSubmit).toHaveLength(1);
    await agentsCommand(ctx(root), { action: 'uninstall' });
    expect(await readJson(path)).toEqual({
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo custom' }] }],
      },
    });
  });
});
