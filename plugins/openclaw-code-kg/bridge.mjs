import { spawn } from 'node:child_process';
import { existsSync, realpathSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { TOOL_NAMES, toolMetadata } from './definitions.mjs';

const ORIENTATION = new Set(['search', 'ask', 'section', 'context', 'map', 'skeleton', 'callers', 'callees', 'impact']);
const LIMIT = 2 * 1024 * 1024;
export const NATIVE_RELAY_PROCESS_TIMEOUT_MS = 7500;
// Installed Codex aliases normalize these names before invoking native hooks.
const NATIVE_TOOL_NAMES = new Set(['exec', 'exec_command', 'apply_patch', 'spawn_agent']);
const nativeTool = event => NATIVE_TOOL_NAMES.has(String(event.toolName ?? '').replace(/^functions\./, ''));
export const HOOK_TIMEOUT_LIMITS = Object.freeze({ pre: 10000, sessionCheck: 10000, session: 30000, prompt: 30000, edit: 45000, stop: 45000 });
// Host waits outlast our owned child-process deadlines, including sequential bootstrap.
export function hostHookBudgets(config) {
  const t = config.hookTimeouts;
  return { before_prompt_build: t.sessionCheck + t.session + t.prompt + 3000, before_tool_call: t.pre + 2000, after_tool_call: t.edit + 2000, before_agent_finalize: t.stop + 2000 };
}
const object = (x) => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
const textResult = (text, isError = false) => ({ content: [{ type: 'text', text }], isError });

export function validateConfig(config) {
  const c = object(config);
  for (const key of ['repository', 'codekgRoot', 'companionPath']) {
    if (typeof c[key] !== 'string' || !isAbsolute(c[key]) || !existsSync(c[key])) throw new Error(`Code-KG ${key} must be an existing absolute path`);
  }
  if (c.agentId !== 'roscoe-supervisor') throw new Error('This bridge is scoped to roscoe-supervisor');
  if (!Array.isArray(c.sessionPrefixes) || !c.sessionPrefixes.length || c.sessionPrefixes.some(x => typeof x !== 'string' || !x.startsWith('agent:roscoe-supervisor:'))) throw new Error('Explicit roscoe-supervisor session prefixes required');
  if (!/^[a-f0-9]{64}$/.test(c.companionSha256)) throw new Error('Reviewed companion SHA256 required');
  const requested = object(c.hookTimeouts);
  if (Object.keys(requested).some(key => !(key in HOOK_TIMEOUT_LIMITS))) throw new Error('Unknown Code-KG hook timeout operation');
  const hookTimeouts = { ...HOOK_TIMEOUT_LIMITS, ...(c.timeoutMs === undefined ? {} : { pre: c.timeoutMs }), ...requested };
  for (const [operation, value] of Object.entries(hookTimeouts)) {
    if (!Number.isInteger(value) || value < 100 || value > HOOK_TIMEOUT_LIMITS[operation]) throw new Error(`Code-KG ${operation} timeout must be 100..${HOOK_TIMEOUT_LIMITS[operation]}ms`);
  }
  return Object.freeze({ ...c, repository: realpathSync(c.repository), codekgRoot: realpathSync(c.codekgRoot), hookTimeouts: Object.freeze(hookTimeouts) });
}

// All aliases map to the same Code-KG vocabulary. A code-mode program is NOT shell;
// its separately emitted nested tool calls must pass this hook themselves.
export function translateTool(event, ctx, repository) {
  let name = String(event.toolName ?? '');
  name = name.replace(/^functions\./, '').replace(/^openclaw__/, '');
  const p = object(event.params ?? event.args);
  const codeMode = (event.toolKind ?? ctx.toolKind) === 'code_mode_exec';
  const aliases = { exec: 'Bash', exec_command: 'Bash', gateway_exec: 'Bash', terminal: 'Bash', bash: 'Bash', read: 'Read', read_file: 'Read', file_fetch: 'Read', dir_fetch: 'Read', ls: 'LS', dir_list: 'LS', grep: 'Grep', glob: 'Glob', apply_patch: 'Edit', write: 'Write', file_write: 'Write', edit: 'Edit', spawn_agent: 'Agent', sessions_spawn: 'Agent' };
  const toolName = codeMode ? 'CodeMode' : aliases[name] ?? name;
  let input = { ...p };
  if (toolName === 'Bash') input = { ...p, command: p.command ?? p.cmd ?? '' };
  if (toolName === 'Edit') input = { ...p, patch: p.patch ?? p.input ?? (typeof event.params === 'string' ? event.params : '') };
  if (toolName === 'Read' || toolName === 'Write') input = { ...p, file_path: p.file_path ?? p.path };
  return { agent: 'claude', session_id: ctx.sessionId, cwd: repository, tool_name: toolName, tool_input: input };
}

export function parseHookOutput(output) {
  if (!output?.trim()) return {};
  const value = JSON.parse(output);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid hook response');
  const specific = object(value.hookSpecificOutput);
  return {
    blocked: value.decision === 'block' || specific.permissionDecision === 'deny',
    reason: String(value.reason ?? specific.permissionDecisionReason ?? ''),
    context: typeof specific.additionalContext === 'string' ? specific.additionalContext : '',
  };
}

const STDERR_TAIL = 4000;
// Diagnostics returned to the model must never carry credential-shaped material.
export function redactSecrets(text) {
  return String(text)
    .replace(/(?:sk|rk|pk)-[A-Za-z0-9_-]{8,}/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted]');
}

export function runProcess(binary, argv, options) {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(new Error('Code-KG cancelled'));
    if (Buffer.byteLength(options.input ?? '') > LIMIT) return reject(new Error('Code-KG input exceeds limit'));
    const child = spawn(binary, argv, { cwd: options.cwd, env: options.env, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', stderr = '', bytes = 0, settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      if (error) {
        child.kill('SIGKILL');
        // Only broker (tool) calls opt in; hook subprocess stderr is never surfaced.
        if (options.captureStderr && stderr.trim()) { error.stderr = stderr.trim(); error.message += `: ${redactSecrets(stderr.trim())}`; }
        reject(error);
      } else resolve(output);
    };
    const cancel = () => finish(new Error('Code-KG cancelled'));
    const timer = setTimeout(() => finish(Object.assign(new Error('Code-KG process timeout'), { code: 'CODEKG_TIMEOUT' })), options.timeoutMs);
    options.signal?.addEventListener('abort', cancel, { once: true });
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > LIMIT) finish(new Error('Code-KG output exceeds limit')); else output += chunk; });
    // Drain stderr without leaking provider credentials or untrusted input into logs.
    child.stderr.on('data', chunk => { bytes += chunk.length; if (bytes > LIMIT) finish(new Error('Code-KG output exceeds limit')); else if (options.captureStderr) stderr = (stderr + chunk).slice(-STDERR_TAIL); });
    child.on('error', () => finish(new Error('Code-KG process unavailable')));
    child.on('close', code => finish(code === 0 ? undefined : new Error(`Code-KG process exited unsuccessfully (${code})`)));
    child.stdin.on('error', () => {});
    child.stdin.end(options.input ?? '');
  });
}

export function createBridge(api, dependencies = {}) {
  const config = validateConfig(api.pluginConfig);
  const invoke = dependencies.runProcess ?? runProcess;
  const sessions = new Map();
  const counters = { pre: 0, post: 0, prompt: 0, session: 0, stop: 0, stopBlocked: 0, secondPass: 0, denied: 0, errors: 0, native: 0, codeMode: 0 };
  const allowed = (ctx) => ctx.agentId === config.agentId && typeof ctx.sessionKey === 'string' && config.sessionPrefixes.some(prefix => ctx.sessionKey.startsWith(prefix));
  const state = (ctx) => {
    if (!ctx.sessionId || !ctx.sessionKey) throw new Error('Code-KG requires trusted session identity');
    const key = `${ctx.sessionKey}\0${ctx.sessionId}`;
    let s = sessions.get(key);
    if (!s) {
      if (sessions.size >= 1000) throw new Error('Code-KG session state capacity exceeded');
      s = { initialized: false, runs: new Map(), pending: [], failures: [], events: [] };
      sessions.set(key, s);
    }
    return s;
  };
  const runState = (ctx, event = {}) => {
    const s = state(ctx);
    const id = ctx.runId ?? event.runId;
    if (!id) throw new Error('Code-KG requires trusted run identity');
    // Turn is included when exposed; no orientation credit leaks to a subsequent turn.
    const key = id;
    const turnId = event.turnId ?? ctx.turnId;
    let r = s.runs.get(key);
    if (!r) { r = { oriented: false, stopBlocked: false, turnId }; s.runs.set(key, r); }
    if (turnId && r.turnId && turnId !== r.turnId) { r.oriented = false; r.stopBlocked = false; }
    if (turnId) r.turnId = turnId;
    if (s.runs.size > 32) s.runs.delete(s.runs.keys().next().value);
    return r;
  };
  const observed = (ctx, event, stage) => {
    try { const s = state(ctx); s.events.push({ stage, runId: ctx.runId ?? event.runId, turnId: event.turnId ?? ctx.turnId, toolName: event.toolName, toolKind: event.toolKind ?? ctx.toolKind, stopHookActive: event.stopHookActive }); if (s.events.length > 40) s.events.shift(); } catch {}
  };
  const recovered = (ctx, stage) => { const s = state(ctx); s.failures = s.failures.filter(x => !x.includes(`at ${stage};`)); };
  const failure = (ctx, stage) => {
    counters.errors++;
    const message = `Code-KG enforcement failed at ${stage}; no successful qualification established. Repair the installation and rerun the check.`;
    try { const s = state(ctx); if (!s.failures.includes(message)) s.failures.push(message); } catch {}
    api.logger?.error(message);
    return message;
  };
  const env = () => ({ ...process.env, CODEKG_AGENT_ROLE: 'orchestrator', NO_COLOR: '1' });
  const cli = async (argv, ctx, input, timeout = config.hookTimeouts.pre) => invoke(process.execPath, [join(config.codekgRoot, 'dist/src/codekg/cli.js'), '--dir', config.repository, '--no-color', ...argv], { cwd: config.repository, env: env(), timeoutMs: timeout, input: input === undefined ? '' : JSON.stringify(input), signal: ctx.abortSignal });
  const hook = async (argv, ctx, input, outerBudget = Infinity) => {
    const operation = argv[0] === 'hook-check' ? 'pre' : argv[0] === 'session-check' ? 'sessionCheck' : argv[1];
    if (!(operation in config.hookTimeouts)) throw new Error('Unbudgeted Code-KG hook operation');
    return parseHookOutput(await cli(argv, ctx, input, Math.min(config.hookTimeouts[operation], outerBudget)));
  };
  const base = (ctx) => ({ agent: 'claude', session_id: ctx.sessionId, cwd: config.repository });
  const queue = (ctx, context) => { if (context) { const s = state(ctx); if (!s.pending.includes(context)) s.pending.push(context.slice(0, 12000)); if (s.pending.length > 20) s.pending.shift(); } };
  const take = (ctx) => { const s = state(ctx); const result = [...s.pending, ...s.failures].join('\n\n'); s.pending = []; return result; };

  async function beforePrompt(event, ctx) {
    if (!allowed(ctx) || ctx.abortSignal?.aborted) return;
    counters.prompt++; observed(ctx, event, 'prompt');
    try {
      const s = state(ctx);
      runState(ctx, event);
      // Cache only a completed session bootstrap. Failed preparation remains retryable.
      if (!s.initialized) {
        if (!s.initializing) s.initializing = (async () => {
          queue(ctx, (await hook(['session-check'], ctx, base(ctx))).context);
          queue(ctx, (await hook(['agent-context', 'session'], ctx, base(ctx))).context);
          s.initialized = true; counters.session++;
        })().finally(() => { s.initializing = undefined; });
        await s.initializing;
      }
      queue(ctx, (await hook(['agent-context', 'prompt'], ctx, { ...base(ctx), prompt: String(event.prompt ?? '').slice(0, 4000) })).context);
      recovered(ctx, 'prompt');
      return { prependContext: take(ctx) };
    } catch { return { prependContext: failure(ctx, 'prompt') }; }
  }

  async function beforeTool(event, ctx) {
    if (!allowed(ctx)) return;
    counters.pre++; observed(ctx, event, 'pre');
    if (ctx.abortSignal?.aborted) return { block: true, blockReason: 'Code-KG: user cancelled this operation.' };
    if (event.toolKind === 'code_mode_exec' || ctx.toolKind === 'code_mode_exec') counters.codeMode++;
    if (['exec', 'apply_patch', 'spawn_agent'].includes(event.toolName)) counters.native++;
    try {
      const mapped = translateTool(event, ctx, config.repository);
      // Administrative and recovery tools are not raw repository access. Code-mode
      // programs are gated at each separately emitted nested invocation.
      if (!['Bash', 'Read', 'LS', 'Grep', 'Glob', 'Write', 'Edit', 'Agent'].includes(mapped.tool_name)) return;
      const target = mapped.tool_input.file_path ?? mapped.tool_input.path;
      if (['Read', 'LS', 'Write', 'Edit'].includes(mapped.tool_name) && typeof target === 'string' && isAbsolute(target)) {
        const actual = existsSync(target) ? realpathSync(target) : target;
        const rel = relative(config.repository, actual);
        if (rel === '..' || rel.startsWith('../') || isAbsolute(rel)) return;
      }
      const r = runState(ctx, event);
      const result = await hook(['hook-check'], ctx, mapped, nativeTool(event) ? NATIVE_RELAY_PROCESS_TIMEOUT_MS : Infinity);
      queue(ctx, result.context);
      recovered(ctx, 'pre-tool');
      if (result.blocked || (result.context && !r.oriented)) {
        counters.denied++;
        return { block: true, blockReason: result.reason || result.context };
      }
    } catch { return { block: true, blockReason: failure(ctx, 'pre-tool') }; }
  }

  async function afterTool(event, ctx) {
    if (!allowed(ctx) || ctx.abortSignal?.aborted) return;
    counters.post++; observed(ctx, event, 'post');
    try {
      const p = object(event.params ?? event.args);
      const result = object(event.result);
      if (event.error || result.isError || result.details?.isError) return;
      const name = String(event.toolName).replace(/^openclaw__/, '');
      const oriented = (name === 'codekg_cli' && ORIENTATION.has(p.argv?.[0])) || (name === 'codekg_mcp' && ORIENTATION.has(String(p.name).replace(/^codekg_/, '')));
      if (oriented) runState(ctx, event).oriented = true;
      const mapped = translateTool(event, ctx, config.repository);
      if (['Edit', 'Write', 'MultiEdit'].includes(mapped.tool_name)) {
        queue(ctx, (await hook(['agent-context', 'edit'], ctx, mapped, nativeTool(event) ? NATIVE_RELAY_PROCESS_TIMEOUT_MS : Infinity)).context);
        recovered(ctx, 'post-tool');
      }
    } catch { failure(ctx, 'post-tool'); }
  }

  async function finalize(event, ctx) {
    if (!allowed(ctx) || ctx.abortSignal?.aborted || event.cancelled === true) return;
    counters.stop++; observed(ctx, event, 'stop');
    try {
      const r = runState(ctx, event);
      const second = event.stopHookActive === true || r.stopBlocked;
      if (second) counters.secondPass++;
      const result = await hook(['agent-context', 'stop'], ctx, { ...base(ctx), stop_hook_active: second }, event.provider === 'codex' ? NATIVE_RELAY_PROCESS_TIMEOUT_MS : Infinity);
      queue(ctx, result.context);
      recovered(ctx, 'stop');
      const errors = state(ctx).failures;
      if (errors.length) {
        return { action: 'revise', reason: errors.join('\n'), retry: { instruction: 'Report the enforcement failure explicitly; do not claim installed or verified. Repair and requalify in a subsequent turn.', idempotencyKey: 'code-kg-enforcement-failure', maxAttempts: 1 } };
      }
      if (result.blocked) { r.stopBlocked = true; counters.stopBlocked++; return { action: 'revise', reason: result.reason, retry: { instruction: 'Follow the Code-KG work lifecycle; preserve human cancellation.', idempotencyKey: 'code-kg-stop', maxAttempts: 1 } }; }
    } catch (error) {
      const failed = failure(ctx, 'stop');
      const nativeTimeout = event.provider === 'codex' && error?.code === 'CODEKG_TIMEOUT';
      // Native relay forwards reason, not retry.instruction, to the next model pass.
      const instruction = nativeTimeout
        ? 'The complete native Stop check exceeded its owned 7.5s deadline. Run codekg_cli with argv ["map"] using its long command budget to refresh and validate the full graph, inspect any errors, then retry Stop. If needed inspect codekg_cli with argv ["agent-context","stop"]. Do not claim enforcement passed: no guard result from the timed-out check was admitted.'
        : 'Report Code-KG enforcement as failed, never passed.';
      return { action: 'revise', reason: `${failed}\n${instruction}`, retry: { instruction, idempotencyKey: 'code-kg-enforcement-failure', maxAttempts: 1 } };
    }
  }

  const broker = async (request, ctx) => {
    // Trusted identity only. The tool's options can never become command context.
    const requestedId = request.options?.id ?? request.arguments?.id ?? (request.argv?.[0] === 'work' ? request.argv[request.argv[1] === 'evidence' ? 3 : 2] : undefined);
    const binding = config.workBindings?.find(x => x.id === requestedId);
    const authority = { actor: `${config.agentId}:${ctx.sessionId}`, role: 'reviewer', ...(binding ? { workId: binding.id, sealedRevision: binding.sealedRevision } : {}) };
    if (createHash('sha256').update(readFileSync(config.companionPath)).digest('hex') !== config.companionSha256) throw new Error('Code-KG companion digest mismatch');
    const response = await invoke(process.execPath, [config.companionPath], { cwd: config.repository, env: env(), timeoutMs: config.commandTimeoutMs ?? 120000, signal: ctx.abortSignal, captureStderr: true, input: JSON.stringify({ ...request, codekgRoot: config.codekgRoot, repository: config.repository, authority }) });
    return request.kind === 'cli' ? response : JSON.parse(response);
  };
  const toolFactory = (ctx) => {
    if (!allowed(ctx)) return null;
    state(ctx);
    return TOOL_NAMES.map(name => ({
      name,
      ...toolMetadata(name),
      async execute(_id, params, signal) {
        const toolCtx = { ...ctx, abortSignal: signal ?? ctx.abortSignal };
        try {
          if (name === 'codekg_bridge_status') return textResult(JSON.stringify({ processCounters: counters, nativeRelayProcessTimeoutMs: NATIVE_RELAY_PROCESS_TIMEOUT_MS, hookTimeouts: config.hookTimeouts, hostHookBudgets: hostHookBudgets(config), session: { id: ctx.sessionId, key: ctx.sessionKey, initialized: state(ctx).initialized, failures: state(ctx).failures, events: state(ctx).events, pendingContext: state(ctx).pending.length }, repository: config.repository, role: 'orchestrator', workRole: 'reviewer', qualification: 'Counts show observed events, not end-to-end host certification.' }));
          if (name === 'codekg_cli') {
            if (!Array.isArray(params.argv) || !params.argv.length || params.argv.some(x => typeof x !== 'string' || x.includes('\0') || /^--dir(?:=|$)/.test(x))) throw new Error('Invalid argv');
            // The companion invokes the SAME CLI parser with an immutable trusted binding.
            return textResult(await broker({ kind: 'cli', argv: params.argv }, toolCtx));
          }
          const result = await broker(name === 'codekg_mcp' ? { kind: 'mcp', name: params.name, arguments: params.arguments } : { kind: 'work', command: params.command, options: params.options }, toolCtx);
          if (Array.isArray(result.content)) return result;
          return textResult(result.output ?? JSON.stringify(result), result.isError === true);
        } catch (error) {
          // The real reason (CLI error text, admission refusal, digest mismatch) is the model's next action.
          const reason = redactSecrets(error?.message ?? String(error)).slice(0, 1500);
          return textResult(`Code-KG ${name} failed: ${reason}`, true);
        }
      },
    }));
  };
  return { beforePrompt, beforeTool, afterTool, finalize, toolFactory, counters, allowed };
}

// Hooks and tool factories may be handed different api objects (or even different
// module instances) by the host; the session/run state they share must be process-wide.
const SHARED = Symbol.for('code-kg.openclaw.bridge.registry');
export function sharedBridge(api, dependencies = {}) {
  const registry = (globalThis[SHARED] ??= new Map());
  const key = createHash('sha256').update(JSON.stringify(api.pluginConfig ?? null)).digest('hex');
  let bridge = registry.get(key);
  if (!bridge) { bridge = createBridge(api, dependencies); registry.set(key, bridge); }
  return bridge;
}
