import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { NATIVE_RELAY_PROCESS_TIMEOUT_MS, createBridge, sharedBridge, redactSecrets, translateTool, parseHookOutput, runProcess, validateConfig, hostHookBudgets } from '../bridge.mjs';

// A linked checkout shares its canonical build; directory depth is not identity.
const source = process.env.CODEKG_TEST_ROOT ?? dirname(resolve(import.meta.dirname,
  execFileSync('git', ['-C', import.meta.dirname, 'rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim(),
));
const root = mkdtempSync(join(tmpdir(), 'codekg-bridge-'));
const ctx = { agentId: 'roscoe-supervisor', sessionKey: 'agent:roscoe-supervisor:main', sessionId: 'fixture-session', runId: 'run-1' };
const hookContext = (text) => JSON.stringify({ hookSpecificOutput: { additionalContext: text } });
const companionPath = resolve(import.meta.dirname, '../runner.mjs');
const companionSha256 = createHash('sha256').update(readFileSync(companionPath)).digest('hex');
const config = { companionPath, companionSha256, repository: root, codekgRoot: source, agentId: 'roscoe-supervisor', sessionPrefixes: ['agent:roscoe-supervisor:'], timeoutMs: 10000 };
const api = () => ({ pluginConfig: config, logger: { error() {} } });
const mock = (fn = async () => '') => { const calls = []; return { calls, runProcess: async (bin, argv, opts) => { calls.push({ bin, argv, opts }); return fn(argv, opts); } }; };

test.after(() => rmSync(root, { recursive: true, force: true }));

test('measured lifecycle budgets are isolated from pre-tool and fit host registration deadlines', async () => {
  const dep = mock(); const bridge = createBridge(api(), dep);
  await bridge.beforePrompt({ prompt: 'architecture' }, ctx);
  await bridge.beforeTool({ toolName: 'gateway_exec', params: { command: 'rg x' } }, ctx);
  await bridge.afterTool({ toolName: 'file_write', params: { path: 'x.js' }, result: {} }, ctx);
  await bridge.finalize({}, ctx);
  assert.deepEqual(dep.calls.map(c => c.opts.timeoutMs), [10000, 30000, 30000, 10000, 45000, 45000]);
  const validated = validateConfig(config);
  assert.deepEqual(hostHookBudgets(validated), { before_prompt_build: 73000, before_tool_call: 12000, after_tool_call: 47000, before_agent_finalize: 47000 });
  assert.throws(() => validateConfig({ ...config, hookTimeouts: { pre: 11000 } }), /pre timeout/);
  assert.throws(() => validateConfig({ ...config, hookTimeouts: { stop: 45001 } }), /stop timeout/);
  assert.throws(() => validateConfig({ ...config, hookTimeouts: { unknown: 10 } }), /Unknown/);
  const lower = validateConfig({ ...config, hookTimeouts: { stop: 1000 } });
  assert.equal(hostHookBudgets(lower).before_agent_finalize, 3000);
  assert.equal(lower.hookTimeouts.pre, 10000);
  const tool = bridge.toolFactory(ctx).find(t => t.name === 'codekg_bridge_status');
  const status = JSON.parse((await tool.execute('status', {})).content[0].text);
  assert.equal(status.hookTimeouts.stop, 45000);
});

test('canonical/native/dynamic aliases retain shell and patch parameters; code mode is never shell', () => {
  for (const name of ['exec', 'exec_command', 'openclaw__gateway_exec']) assert.equal(translateTool({ toolName: name, params: { cmd: 'rg x' } }, ctx, root).tool_input.command, 'rg x');
  assert.equal(translateTool({ toolName: 'exec', toolKind: 'code_mode_exec', params: { code: 'tools.exec({command:"rg x"})' } }, ctx, root).tool_name, 'CodeMode');
  assert.equal(translateTool({ toolName: 'apply_patch', params: { input: '*** Update File: x.js' } }, ctx, root).tool_input.patch, '*** Update File: x.js');
  assert.equal(translateTool({ toolName: 'spawn_agent', params: {} }, ctx, root).tool_name, 'Agent');
});

test('other agent, foreign session and administrative tools remain untouched', async () => {
  const dep = mock(); const bridge = createBridge(api(), dep);
  assert.equal(await bridge.beforeTool({ toolName: 'exec' }, { ...ctx, agentId: 'other' }), undefined);
  assert.equal(await bridge.beforePrompt({ prompt: 'hello' }, { ...ctx, sessionKey: 'agent:other:main' }), undefined);
  assert.equal(bridge.toolFactory({ ...ctx, agentId: 'other' }), null);
  assert.equal(await bridge.beforeTool({ toolName: 'gateway', params: { action: 'status' } }, ctx), undefined);
  assert.equal(dep.calls.length, 0);
  assert.equal((await bridge.beforeTool({ toolName: 'exec' }, { ...ctx, runId: undefined })).block, true);
});

test('search-first admission requires successful retrieval and never inherits another run/session credit', async () => {
  const dep = mock(async () => hookContext('graph first')); const bridge = createBridge(api(), dep);
  const read = { toolName: 'exec', params: { cmd: 'rg symbol src' } };
  assert.equal((await bridge.beforeTool(read, ctx)).block, true);
  await bridge.afterTool({ toolName: 'codekg_cli', params: { argv: ['search', 'symbol'] }, result: { isError: true } }, ctx);
  assert.equal((await bridge.beforeTool(read, ctx)).block, true);
  await bridge.afterTool({ toolName: 'codekg_cli', params: { argv: ['search', 'symbol'] }, result: { content: [{ type: 'text', text: 'graph' }] } }, ctx);
  assert.equal(await bridge.beforeTool(read, ctx), undefined);
  assert.equal((await bridge.beforeTool(read, { ...ctx, runId: 'run-2' })).block, true);
  assert.equal((await bridge.beforeTool(read, { ...ctx, sessionId: 'another' })).block, true);
  assert.equal(await bridge.beforeTool({ toolName: 'exec', toolKind: 'code_mode_exec', params: { code: 'tools.gateway_exec(...)' } }, ctx), undefined);
  assert.equal((await bridge.beforeTool({ toolName: 'openclaw__gateway_exec', params: { command: 'rg symbol' } }, { ...ctx, runId: 'nested-new-run' })).block, true);
});

test('new proven turn resets orientation, missing after-tool turn does not lose same-run credit', async () => {
  const bridge = createBridge(api(), mock(async () => hookContext('graph first')));
  const read = { toolName: 'exec', params: { cmd: 'rg x' }, turnId: 't1' };
  await bridge.beforeTool(read, ctx);
  await bridge.afterTool({ toolName: 'codekg_mcp', params: { name: 'codekg_search' }, result: { content: [] } }, ctx);
  assert.equal(await bridge.beforeTool(read, ctx), undefined);
  assert.equal((await bridge.beforeTool({ ...read, turnId: 't2' }, ctx)).block, true);
});

test('session bootstrap runs once, prompt retrieval remains per prompt and cannot select root/role/session', async () => {
  const dep = mock(async () => hookContext('context')); const bridge = createBridge(api(), dep);
  const first = await bridge.beforePrompt({ prompt: 'explain architecture', cwd: '/evil', session_id: 'fake' }, ctx);
  await bridge.beforePrompt({ prompt: 'next architecture question' }, { ...ctx, runId: 'run-2' });
  assert.match(first.prependContext, /context/);
  assert.equal(dep.calls.filter(c => c.argv.includes('session-check')).length, 1);
  assert.equal(dep.calls.filter(c => c.argv.includes('session')).length, 1);
  assert.equal(dep.calls.filter(c => c.argv.includes('prompt')).length, 2);
  for (const c of dep.calls) { assert.equal(c.opts.cwd, root); assert.equal(c.opts.env.CODEKG_AGENT_ROLE, 'orchestrator'); assert.equal(JSON.parse(c.opts.input).session_id, ctx.sessionId); }
});

test('native relay deadlines finish with explicit failure/revise before the outer RPC while direct Stop retains 45s', async () => {
  const dep = mock(async (_argv, options) => {
    if (options.timeoutMs === NATIVE_RELAY_PROCESS_TIMEOUT_MS) throw Object.assign(new Error('timeout'), { code: 'CODEKG_TIMEOUT' });
    return '';
  });
  const bridge = createBridge(api(), dep);
  const result = await bridge.finalize({ provider: 'codex' }, ctx);
  assert.equal(dep.calls.at(-1).opts.timeoutMs, 7500);
  assert.equal(result.action, 'revise');
  assert.match(result.reason, /codekg_cli.*map/);
  assert.match(result.reason, /no guard result.*admitted/);
  assert.equal(result.retry.maxAttempts, 1);
  assert.equal(await bridge.finalize({ provider: 'other' }, ctx), undefined);
  assert.equal(dep.calls.at(-1).opts.timeoutMs, 45000);
  assert.equal((await bridge.beforeTool({ toolName: 'exec', params: { cmd: 'rg x' } }, ctx)).block, true);
  assert.equal(dep.calls.at(-1).opts.timeoutMs, 7500);
  await bridge.afterTool({ toolName: 'apply_patch', params: { input: 'patch' }, result: {} }, ctx);
  assert.equal(dep.calls.at(-1).opts.timeoutMs, 7500);
  assert.match((await bridge.finalize({}, ctx)).reason, /post-tool/);
  const success = mock(); const fast = createBridge(api(), success);
  assert.equal(await fast.finalize({ provider: 'codex' }, ctx), undefined);
  assert.equal(success.calls[0].opts.timeoutMs, 7500);
});

test('Stop block requests a bounded extra pass, preserving actual stopHookActive and cancellation', async () => {
  const dep = mock(async (_a, opts) => JSON.parse(opts.input).stop_hook_active ? hookContext('issues remain') : JSON.stringify({ decision: 'block', reason: 'open work' }));
  const bridge = createBridge(api(), dep);
  assert.equal((await bridge.finalize({}, ctx)).action, 'revise');
  assert.equal(await bridge.finalize({ stopHookActive: true }, ctx), undefined);
  assert.equal(bridge.counters.secondPass, 1);
  const count = dep.calls.length;
  assert.equal(await bridge.finalize({ cancelled: true }, ctx), undefined);
  const controller = new AbortController(); controller.abort();
  assert.equal(await bridge.finalize({}, { ...ctx, abortSignal: controller.signal }), undefined);
  assert.equal(dep.calls.length, count);
});

test('malformed/process failures cannot be reported as successful precheck or finalization', async () => {
  const bridge = createBridge(api(), mock(async () => 'not json'));
  assert.equal((await bridge.beforeTool({ toolName: 'exec', params: {} }, ctx)).block, true);
  assert.equal((await bridge.finalize({}, ctx)).action, 'revise');
  assert.throws(() => parseHookOutput('[]'));
  assert.equal(parseHookOutput('{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"denied"}}').blocked, true);
});

test('post-edit failures surface at Stop and do not rerun edit for failed tools', async () => {
  const dep = mock(async argv => { if (argv.includes('edit')) throw new Error('no'); return ''; });
  const bridge = createBridge(api(), dep);
  await bridge.afterTool({ toolName: 'apply_patch', params: { input: '*** Update File: x.js' }, result: {} }, ctx);
  assert.match((await bridge.finalize({}, ctx)).reason, /post-tool/);
  const calls = dep.calls.length;
  await bridge.afterTool({ toolName: 'apply_patch', error: 'tool failed' }, ctx);
  assert.equal(calls, dep.calls.length);
});

test('process cancellation, timeout and nonzero failure are bounded', async () => {
  const opts = { cwd: root, env: process.env, timeoutMs: 100, input: '' };
  await assert.rejects(runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], opts), error => error.code === 'CODEKG_TIMEOUT' && /timeout/.test(error.message));
  await assert.rejects(runProcess(process.execPath, ['-e', 'process.exit(2)'], { ...opts, timeoutMs: 2000 }), /unsuccessfully/);
  const c = new AbortController(); c.abort();
  await assert.rejects(runProcess(process.execPath, ['-e', ''], { ...opts, signal: c.signal }), /cancelled/);
});

test('full tool broker binds trusted reviewer context; user options cannot forge it', async () => {
  const dep = mock(async () => JSON.stringify({ output: 'ok' }));
  const bridge = createBridge({ ...api(), pluginConfig: { ...config, workBindings: [{ id: 'ck-1234', sealedRevision: 'rev-1' }] } }, dep);
  const tools = bridge.toolFactory(ctx);
  const work = tools.find(t => t.name === 'codekg_work');
  await work.execute('1', { command: 'close', options: { id: 'ck-1234', workAuthority: { role: 'operator' } } });
  const request = JSON.parse(dep.calls[0].opts.input);
  assert.deepEqual(request.authority, { actor: 'roscoe-supervisor:fixture-session', role: 'reviewer', workId: 'ck-1234', sealedRevision: 'rev-1' });
  assert.equal(request.repository, root);
  assert.ok(work.parameters.properties.command.enum.includes('cleanup'));
  assert.ok(work.parameters.properties.command.enum.includes('adopt'));
  assert.equal((await tools.find(t => t.name === 'codekg_cli').execute('2', { argv: ['--dir=/evil', 'check'] })).isError, true);
});

// Real implementation fixture: no model service and no mocked Code-KG checks.
test('real Code-KG CLI/MCP fixture: hooks, retrieval, Stop and full MCP listing', { timeout: 120000 }, async () => {
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'fixture@example.invalid']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Fixture']);
  writeFileSync(join(root, 'package.json'), '{"type":"module"}\n');
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src', 'math.ts'), 'export function sum(a:number,b:number){return a+b}\n');
  const cli = join(source, 'dist/src/codekg/cli.js');
  execFileSync(process.execPath, [cli, '--dir', root, 'bootstrap', '--accept'], { timeout: 60000 });
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-qm', 'fixture']);
  mkdirSync(join(root, '.code-kg', 'work'), { recursive: true });
  writeFileSync(join(root, '.code-kg', 'work', 'admission.json'), '{"requireAuthority":true}\n');
  const bridge = createBridge(api());
  const read = { toolName: 'exec_command', params: { cmd: 'rg sum src' } };
  assert.equal((await bridge.beforeTool(read, ctx)).block, true);
  const tools = bridge.toolFactory(ctx);
  const search = await tools.find(t => t.name === 'codekg_cli').execute('search-1', { argv: ['search', 'sum'] });
  assert.equal(search.isError, false);
  await bridge.afterTool({ toolName: 'codekg_cli', params: { argv: ['search', 'sum'] }, result: search }, ctx);
  assert.equal(await bridge.beforeTool(read, ctx), undefined);
  const list = await tools.find(t => t.name === 'codekg_mcp').execute('list-1', {});
  assert.notEqual(list.isError, true, JSON.stringify(list));
  const catalog = JSON.parse(list.content[0].text);
  assert.ok(catalog.tools.some(t => t.name === 'codekg_work_close'));
  assert.ok(catalog.tools.some(t => t.name === 'codekg_search'));
  const mcp = await tools.find(t => t.name === 'codekg_mcp').execute('search-2', { name: 'codekg_search', arguments: { query: 'sum' } });
  assert.notEqual(mcp.isError, true, JSON.stringify(mcp));
  const create = await tools.find(t => t.name === 'codekg_work').execute('create-1', { command: 'create', options: { title: 'Open fixture work', json: true } });
  assert.equal(create.isError, false, JSON.stringify(create));
  const cliWork = await tools.find(t => t.name === 'codekg_cli').execute('cli-work', { argv: ['work', 'create', 'Trusted CLI work', '--json'] });
  assert.equal(cliWork.isError, false, JSON.stringify(cliWork));
  const item = JSON.parse(create.content[0].text);
  const forceClose = await tools.find(t => t.name === 'codekg_work').execute('force-close', { command: 'close', options: { id: item.id ?? item.item?.id, force: true } });
  assert.equal(forceClose.isError, true);
  const mcpForce = await tools.find(t => t.name === 'codekg_mcp').execute('force-mcp', { name: 'codekg_work_close', arguments: { id: item.id ?? item.item?.id, force: true } });
  assert.equal(mcpForce.isError, true);
  const stop = await bridge.finalize({}, { ...ctx, runId: 'stop-fixture' });
  assert.equal(stop.action, 'revise');
  assert.match(stop.reason, /work/i);
  assert.equal(await bridge.finalize({ stopHookActive: true }, { ...ctx, runId: 'stop-fixture' }), undefined);
});


test('companion digest tampering refuses broker execution', async () => {
  const dep = mock();
  const bridge = createBridge({ ...api(), pluginConfig: { ...config, companionSha256: '0'.repeat(64) } }, dep);
  const tool = bridge.toolFactory(ctx).find(t => t.name === 'codekg_mcp');
  assert.equal((await tool.execute('bad-digest', {})).isError, true);
  assert.equal(dep.calls.length, 0);
});

test('hook receipts and counters are shared between hook registration and tool factories', async () => {
  const dep = mock(async () => hookContext('graph first'));
  const shared = { ...config, repository: root, timeoutMs: 9999 };
  const hooks = sharedBridge({ pluginConfig: shared, logger: { error() {} } }, dep);
  const tools = sharedBridge({ pluginConfig: { ...shared }, logger: { error() {} } });
  assert.equal(hooks, tools);
  assert.notEqual(hooks, sharedBridge({ pluginConfig: { ...shared, timeoutMs: 9998 }, logger: { error() {} } }, dep));
  const probe = { ...ctx, sessionId: 'shared-session', runId: 'shared-run' };
  assert.equal((await hooks.beforeTool({ toolName: 'exec', params: { cmd: 'rg x' } }, probe)).block, true);
  const status = JSON.parse((await tools.toolFactory(probe).find(t => t.name === 'codekg_bridge_status').execute('s', {})).content[0].text);
  assert.equal(status.processCounters.pre, 1);
  assert.equal(status.processCounters.denied, 1);
  assert.deepEqual(status.session.events.map(e => e.stage), ['pre']);
});

test('tool failures report the real reason with secrets redacted; hook stderr stays private', async () => {
  const dep = mock(async (_argv, opts) => { if (opts.captureStderr) throw new Error('No graph context found for "README.md". token sk-abcdefghijklmnop'); return ''; });
  const bridge = createBridge(api(), dep);
  const result = await bridge.toolFactory(ctx).find(t => t.name === 'codekg_cli').execute('ctx', { argv: ['context', 'README.md'] });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /No graph context found for "README.md"/);
  assert.doesNotMatch(result.content[0].text, /sk-abcdefghijklmnop/);
  assert.equal(redactSecrets('Bearer abc.def'), 'Bearer [redacted]');
  const opts = { cwd: root, env: process.env, timeoutMs: 5000, input: '' };
  await assert.rejects(runProcess(process.execPath, ['-e', 'console.error("real reason"); process.exit(1)'], { ...opts, captureStderr: true }), /unsuccessfully \(1\): real reason/);
  await assert.rejects(runProcess(process.execPath, ['-e', 'console.error("hidden"); process.exit(1)'], opts), error => /unsuccessfully \(1\)$/.test(error.message));
});
