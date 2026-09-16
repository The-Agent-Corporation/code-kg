// Invoked only by the reviewed host bridge. No credentials are accepted in input.
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

export async function dispatch(request) {
  const load = (name) => import(pathToFileURL(join(request.codekgRoot, 'dist/src', name)).href);
  const { plainStyler } = await load('context.js');
  const ctx = {
    projectRoot: request.repository,
    latDir: join(request.repository, 'lat.md'),
    styler: plainStyler,
    mode: 'mcp',
    workAuthority: request.authority,
  };
  if (request.kind === 'cli') {
    const { runCodeKgCli } = await load('codekg/cli.js');
    await runCodeKgCli({ projectRoot: request.repository, workAuthority: request.authority }, [process.execPath, join(request.codekgRoot, 'dist/src/codekg/cli.js'), '--dir', request.repository, '--no-color', ...request.argv]);
    return;
  }
  if (request.kind === 'work') {
    const work = await load('codekg/work.js');
    return await work.workCommandWithAuthority(ctx, { operation: String(request.command).replaceAll('-', '_'), options: request.options ?? {} });
  }
  if (request.kind !== 'mcp') throw new Error('Unsupported broker operation');
  const { createCodeKgMcpServer } = await load('codekg/mcp.js');
  const server = createCodeKgMcpServer(ctx);
  let serial = 0;
  const waiting = new Map();
  const transport = {
    async start() {},
    async close() {},
    async send(message) {
      if (message.id !== undefined) {
        const waiter = waiting.get(message.id);
        waiting.delete(message.id);
        if (message.error) waiter?.reject(new Error(message.error.message));
        else waiter?.resolve(message.result);
      }
    },
  };
  const call = (method, params) => new Promise((resolve, reject) => {
    const id = ++serial;
    waiting.set(id, { resolve, reject });
    transport.onmessage({ jsonrpc: '2.0', id, method, params });
  });
  await server.connect(transport);
  try {
    await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'openclaw-code-kg', version: '0.2.0' } });
    transport.onmessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
    return await call(request.name ? 'tools/call' : 'tools/list', request.name ? { name: request.name, arguments: request.arguments ?? {} } : {});
  } finally {
    await server.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void (async () => {
    try {
      const raw = readFileSync(0, 'utf8');
      if (raw.length > 2097152) throw new Error('Input too large');
      const request = JSON.parse(raw);
      const result = await dispatch(request);
      if (request.kind !== 'cli') process.stdout.write(JSON.stringify(result));
    } catch { process.stderr.write('Code-KG broker failed; check installation and command schema.'); process.exitCode = 1; }
  })();
}
