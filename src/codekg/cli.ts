#!/usr/bin/env node

if (!process.argv.includes('--verbose')) {
  process.noDeprecation = true;
}

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command, InvalidArgumentError } from 'commander';
import { plainStyler, type CmdContext, type CmdResult } from '../context.js';
import type { CodeKgSearchBackend } from './search.js';
import { resolveContext } from '../cli/context.js';
import {
  createBootstrapPlan,
  formatMaterializationPreview,
  writeBootstrapPlan,
} from './bootstrap.js';
import { codeKgCheckCommand } from './check.js';
import {
  extractProjectGraph,
  formatGraphReport,
  writeGraphCache,
} from './graph.js';

type PreviewAcceptOptions = {
  preview?: boolean;
  accept?: boolean;
};

type ExtractOptions = {
  json?: boolean;
  writeCache?: boolean;
};

type DriftOptions = {
  applySafe?: boolean;
};

type ReconcileOptions = {
  preview?: boolean;
  write?: boolean;
};

type ConfidenceReconcileOptions = {
  acceptPromotions?: boolean;
};

type ApplyBacklinksOptions = {
  preview?: boolean;
  write?: boolean;
};

type SearchCliOptions = {
  semantic?: boolean;
  backend?: CodeKgSearchBackend;
  limit: number;
  reindex?: boolean;
};

type InstallGlobalOptions = {
  binDir?: string;
};

function findVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = join(dir, 'package.json');
    try {
      return JSON.parse(readFileSync(candidate, 'utf-8')).version;
    } catch {}
    const parent = dirname(dir);
    if (parent === dir) return '0.0.0';
    dir = parent;
  }
}

function handleResult(result: CmdResult): void {
  if (result.isError) {
    console.error(result.output);
    process.exit(1);
  }
  if (result.output) console.log(result.output);
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError('must be a positive integer');
  }
  return parsed;
}

function parseSearchBackend(value: string): CodeKgSearchBackend {
  if (
    value === 'local' ||
    value === 'semantic' ||
    value === 'auto-semantic' ||
    value === 'hybrid'
  ) {
    return value;
  }
  throw new InvalidArgumentError(
    'must be "local", "semantic", "auto-semantic", or "hybrid"',
  );
}

async function readStdinIfAvailable(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;
  let input = '';
  for await (const chunk of process.stdin) {
    input += String(chunk);
  }
  return input || undefined;
}

async function runCheck(root: string): Promise<CmdResult> {
  return codeKgCheckCommand({
    latDir: join(root, 'lat.md'),
    projectRoot: root,
    styler: plainStyler,
    mode: 'cli',
  });
}

function rootOnlyContext(): CmdContext {
  const root = resolve(program.opts().dir ?? process.cwd());
  return {
    latDir: join(root, 'lat.md'),
    projectRoot: root,
    styler: plainStyler,
    mode: 'cli',
  };
}

async function runMaterialization(
  title: string,
  opts: PreviewAcceptOptions,
): Promise<void> {
  if (!opts.preview && !opts.accept) {
    opts.preview = true;
  }
  const root = resolve(program.opts().dir ?? process.cwd());
  const plan = await createBootstrapPlan(root);
  if (opts.preview) {
    console.log(await formatMaterializationPreview(plan));
    return;
  }
  const changes = await writeBootstrapPlan(plan);
  console.log(['# ' + title, '', ...changes.map((c) => `- ${c}`)].join('\n'));
  const result = await runCheck(root);
  handleResult(result);
}

async function runExtract(rootArg = '.', opts: ExtractOptions): Promise<void> {
  const base = resolve(program.opts().dir ?? process.cwd());
  const root = resolve(base, rootArg);
  const graph = await extractProjectGraph(root);
  const cachePath = opts.writeCache
    ? await writeGraphCache(root, graph)
    : undefined;
  if (opts.json) {
    if (cachePath) {
      process.stderr.write(`Wrote ${cachePath}\n`);
    }
    console.log(JSON.stringify(graph, null, 2));
    return;
  }
  console.log(
    cachePath
      ? `${formatGraphReport(root, graph)}\n\n## Cache\n\n- Wrote ${cachePath}`
      : formatGraphReport(root, graph),
  );
}

const program = new Command();

program
  .name('code-kg')
  .description(
    'Bootstrap and maintain a lat.md knowledge graph for code agents',
  )
  .version(findVersion())
  .option('--dir <path>', 'project root (default: cwd)')
  .option('--no-color', 'disable color output')
  .option('--verbose', 'show extra diagnostics');

program
  .command('bootstrap')
  .description('Preview or create the first Code-KG lat.md knowledge base')
  .option('--preview', 'show what would be generated')
  .option('--accept', 'write generated files')
  .action(async (opts: PreviewAcceptOptions) =>
    runMaterialization('Code-KG Bootstrap', opts),
  );

program
  .command('materialize')
  .description('Preview or write generated lat.md materialization')
  .option('--preview', 'show what would be generated')
  .option('--accept', 'write generated files')
  .action(async (opts: PreviewAcceptOptions) =>
    runMaterialization('Code-KG Materialize', opts),
  );

program
  .command('extract')
  .description('Run deterministic structural graph extraction')
  .argument('[root]', 'directory to inspect', '.')
  .option('--json', 'print the ProjectGraph JSON')
  .option('--write-cache', 'write .code-kg/cache/graph.json')
  .action(async (root: string, opts: ExtractOptions) => runExtract(root, opts));

program
  .command('init')
  .description('Create the initial Code-KG knowledge base')
  .action(async () => {
    const root = resolve(program.opts().dir ?? process.cwd());
    const plan = await createBootstrapPlan(root);
    const changes = await writeBootstrapPlan(plan);
    const { installGitHook } = await import('./git-hooks.js');
    changes.push(await installGitHook(root));
    console.log(
      ['# Code-KG Init', '', ...changes.map((c) => `- ${c}`)].join('\n'),
    );
    const result = await runCheck(root);
    handleResult(result);
  });

program
  .command('doctor')
  .description('Check Code-KG setup health')
  .action(async () => {
    const ctx = rootOnlyContext();
    const { doctorCommand } = await import('./doctor.js');
    handleResult(await doctorCommand(ctx));
  });

program
  .command('install-global')
  .description('Install a code-kg wrapper into a PATH bin directory')
  .option('--bin-dir <path>', 'bin directory for the code-kg wrapper')
  .action(async (opts: InstallGlobalOptions) => {
    const { installGlobalCommand } = await import('./global-install.js');
    handleResult(await installGlobalCommand(opts));
  });

const semantic = program
  .command('semantic')
  .description('Configure and maintain semantic search');

semantic
  .command('status')
  .description('Show semantic search provider and vector cache status')
  .action(async () => {
    const ctx = resolveContext(program.opts());
    const { semanticCommand } = await import('./semantic.js');
    handleResult(await semanticCommand(ctx, { action: 'status' }));
  });

semantic
  .command('enable-local')
  .description('Use local embeddings for semantic search')
  .action(async () => {
    const ctx = resolveContext(program.opts());
    const { semanticCommand } = await import('./semantic.js');
    handleResult(await semanticCommand(ctx, { action: 'enable-local' }));
  });

semantic
  .command('reindex')
  .description('Rebuild the semantic search vector cache')
  .action(async () => {
    const ctx = resolveContext(program.opts());
    const { semanticCommand } = await import('./semantic.js');
    handleResult(await semanticCommand(ctx, { action: 'reindex' }));
  });

program
  .command('search')
  .description('Search lat.md sections with local or semantic retrieval')
  .argument('[query]')
  .option('--semantic', 'use semantic embedding search')
  .option(
    '--backend <backend>',
    'search backend: local, semantic, or auto-semantic',
    parseSearchBackend,
    'local',
  )
  .option('--limit <n>', 'max results', parsePositiveInteger, 5)
  .option('--reindex', 'rebuild the semantic search index')
  .action(async (query: string | undefined, opts: SearchCliOptions) => {
    const ctx = resolveContext(program.opts());
    const backend = opts.semantic ? 'semantic' : opts.backend;
    const { codeKgSearchCommand } = await import('./search.js');
    handleResult(
      await codeKgSearchCommand(ctx, query, {
        backend,
        limit: opts.limit,
        reindex: opts.reindex,
      }),
    );
  });

program
  .command('context')
  .description('Show graph, docs, and test context for a file or symbol')
  .argument('<query>', 'file path, symbol, or graph node label')
  .action(async (query: string) => {
    const ctx = resolveContext(program.opts());
    const { contextCommand } = await import('./context.js');
    handleResult(await contextCommand(ctx, query));
  });

program
  .command('gaps')
  .description('Report missing knowledge, anchors, and test coverage')
  .action(async () => {
    const ctx = resolveContext(program.opts());
    const { gapsCommand } = await import('./gaps.js');
    handleResult(await gapsCommand(ctx));
  });

program
  .command('changed')
  .description('Show Code-KG impact for current git working-tree changes')
  .action(async () => {
    const ctx = resolveContext(program.opts());
    const { changedCommand } = await import('./changed.js');
    handleResult(await changedCommand(ctx));
  });

program
  .command('update')
  .description('Refresh generated knowledge, semantic index, check, and drift')
  .action(async () => {
    const ctx = resolveContext(program.opts());
    const { updateCommand } = await import('./update.js');
    handleResult(await updateCommand(ctx));
  });

program
  .command('enrich')
  .description(
    'Rewrite generated section summaries with an LLM (requires LAT_LLM_KEY)',
  )
  .option(
    '--source',
    'Describe actual source files in a disposable, freshness-checked cache',
  )
  .option(
    '--base-url <url>',
    'OpenAI-compatible model endpoint, including localhost',
  )
  .option('--model <model>', 'Source summary model')
  .option(
    '--limit <count>',
    'Maximum source files to generate',
    parsePositiveInteger,
    20,
  )
  .action(async (opts) => {
    const ctx = resolveContext(program.opts());
    if (opts.source) {
      const { enrichSourcesCommand } = await import('./meaning.js');
      handleResult(await enrichSourcesCommand(ctx, opts));
      return;
    }
    const { enrichCommand } = await import('./enrich.js');
    handleResult(await enrichCommand(ctx));
  });

for (const command of ['locate', 'section', 'refs', 'expand'] as const) {
  const cmd = program.command(command).allowUnknownOption(true);
  cmd.argument('<query>');
  cmd.action(async (query: string) => {
    const ctx = resolveContext(program.opts());
    if (command === 'locate') {
      const { locateCommand } = await import('../cli/locate.js');
      handleResult(await locateCommand(ctx, query));
    } else if (command === 'section') {
      const { sectionCommand } = await import('../cli/section.js');
      handleResult(await sectionCommand(ctx, query));
    } else if (command === 'refs') {
      const { refsCommand } = await import('../cli/refs.js');
      handleResult(await refsCommand(ctx, query, 'md+code'));
    } else {
      const { expandCommand } = await import('../cli/expand.js');
      handleResult(await expandCommand(ctx, query));
    }
  });
}

program
  .command('check')
  .description('Validate lat.md and Code-KG metadata')
  .action(async () => {
    const ctx = resolveContext(program.opts());
    handleResult(await codeKgCheckCommand(ctx));
  });

program
  .command('drift')
  .description('Report drift between code and knowledge base')
  .option('--apply-safe', 'apply safe manifest metadata updates')
  .action(async (opts: DriftOptions) => {
    const ctx = resolveContext(program.opts());
    const { driftCommand } = await import('./drift.js');
    handleResult(await driftCommand(ctx, opts));
  });

program
  .command('reconcile')
  .description('Reconcile generated section status in the manifest')
  .option('--preview', 'show manifest status changes without writing')
  .option('--write', 'write manifest status changes')
  .action(async (opts: ReconcileOptions) => {
    const ctx = resolveContext(program.opts());
    const { reconcileCommand } = await import('./reconcile.js');
    handleResult(await reconcileCommand(ctx, { write: opts.write === true }));
  });

const confidence = program
  .command('confidence')
  .description('List or resolve manifest confidence review items');

confidence
  .command('list')
  .description('List inferred and ambiguous manifest relationships')
  .action(async () => {
    const ctx = resolveContext(program.opts());
    const { confidenceCommand } = await import('./confidence.js');
    handleResult(await confidenceCommand(ctx, { action: 'list' }));
  });

confidence
  .command('accept')
  .description('Mark a manifest relationship as accepted')
  .argument('<relationship-id>', 'manifest relationship id')
  .action(async (relationshipId: string) => {
    const ctx = resolveContext(program.opts());
    const { confidenceCommand } = await import('./confidence.js');
    handleResult(
      await confidenceCommand(ctx, {
        action: 'accept',
        relationshipId,
      }),
    );
  });

confidence
  .command('reject')
  .description('Mark a manifest relationship as rejected')
  .argument('<relationship-id>', 'manifest relationship id')
  .action(async (relationshipId: string) => {
    const ctx = resolveContext(program.opts());
    const { confidenceCommand } = await import('./confidence.js');
    handleResult(
      await confidenceCommand(ctx, {
        action: 'reject',
        relationshipId,
      }),
    );
  });

confidence
  .command('reconcile')
  .description('Detect confidence annotations removed from markdown')
  .option(
    '--accept-promotions',
    'mark detected promotion candidates as accepted',
  )
  .action(async (opts: ConfidenceReconcileOptions) => {
    const ctx = resolveContext(program.opts());
    const { confidenceCommand } = await import('./confidence.js');
    handleResult(
      await confidenceCommand(ctx, {
        action: 'reconcile',
        acceptPromotions: opts.acceptPromotions === true,
      }),
    );
  });

const suppress = program
  .command('suppress')
  .description('List or update suppression tombstones');

suppress
  .command('list')
  .description('List suppressed graph nodes and relationships')
  .action(async () => {
    const ctx = resolveContext(program.opts());
    const { suppressCommand } = await import('./suppress.js');
    handleResult(await suppressCommand(ctx, { action: 'list' }));
  });

suppress
  .command('node')
  .description('Suppress a graph node candidate')
  .argument('<node-id>', 'graph node id')
  .action(async (id: string) => {
    const ctx = resolveContext(program.opts());
    const { suppressCommand } = await import('./suppress.js');
    handleResult(await suppressCommand(ctx, { action: 'node', id }));
  });

suppress
  .command('relationship')
  .description('Suppress a graph relationship candidate')
  .argument('<relationship-id>', 'graph relationship id')
  .action(async (id: string) => {
    const ctx = resolveContext(program.opts());
    const { suppressCommand } = await import('./suppress.js');
    handleResult(await suppressCommand(ctx, { action: 'relationship', id }));
  });

suppress
  .command('clear')
  .description('Clear a suppression tombstone by id')
  .argument('<id>', 'suppressed node or relationship id')
  .action(async (id: string) => {
    const ctx = resolveContext(program.opts());
    const { suppressCommand } = await import('./suppress.js');
    handleResult(await suppressCommand(ctx, { action: 'clear', id }));
  });

program
  .command('apply-backlinks')
  .description('Preview or insert edit-safe @lat source backlinks')
  .option('--preview', 'show source backlinks without writing')
  .option('--write', 'insert source backlinks')
  .action(async (opts: ApplyBacklinksOptions) => {
    const ctx = resolveContext(program.opts());
    const { applyBacklinksCommand } = await import('./backlinks.js');
    handleResult(
      await applyBacklinksCommand(ctx, { write: opts.write === true }),
    );
  });


const work = program
  .command('work')
  .description(
    'Agent work tracker (Beads/GSD-style) primed by the Code-KG knowledge graph',
  );

work
  .command('init')
  .description('Initialize .code-kg/work storage')
  .action(async () => {
    const { workInitCommand } = await import('./work.js');
    handleResult(await workInitCommand(rootOnlyContext()));
  });

work
  .command('create')
  .description('Create a work item')
  .argument('<title>', 'work title')
  .option('-d, --description <text>', 'longer description')
  .option('-t, --type <type>', 'task, bug, feature, epic, or chore', 'task')
  .option('-p, --priority <n>', 'priority 0 (highest) to 4', (v) => Number(v))
  .option('--parent <id>', 'parent work id')
  .option('--dep <id>', 'blocking dependency id', (v, acc: string[]) => [...acc, v], [])
  .option('--discovered-from <id>', 'provenance parent work id')
  .option('--query <text>', 'knowledge query to run on start', (v, acc: string[]) => [...acc, v], [])
  .option('--section <id>', 'linked knowledge section id', (v, acc: string[]) => [...acc, v], [])
  .option('--source <path>', 'linked source path', (v, acc: string[]) => [...acc, v], [])
  .option('--json', 'emit JSON')
  .action(
    async (
      title: string,
      opts: {
        description?: string;
        type?: string;
        priority?: number;
        parent?: string;
        dep?: string[];
        discoveredFrom?: string;
        query?: string[];
        section?: string[];
        source?: string[];
        json?: boolean;
      },
    ) => {
      const { workCreateCommand } = await import('./work.js');
      handleResult(
        await workCreateCommand(rootOnlyContext(), {
          title,
          description: opts.description,
          type: opts.type,
          priority: opts.priority,
          parent: opts.parent,
          deps: opts.dep,
          discoveredFrom: opts.discoveredFrom,
          queries: opts.query,
          sectionIds: opts.section,
          sourcePaths: opts.source,
          json: opts.json,
        }),
      );
    },
  );

work
  .command('list')
  .description('List work items')
  .option('--status <status>', 'open, in_progress, blocked, closed, or all', 'all')
  .option('--json', 'emit JSON')
  .action(async (opts: { status?: string; json?: boolean }) => {
    const { workListCommand } = await import('./work.js');
    handleResult(await workListCommand(rootOnlyContext(), opts));
  });

work
  .command('ready')
  .description('List unblocked open work')
  .option('--json', 'emit JSON')
  .action(async (opts: { json?: boolean }) => {
    const { workReadyCommand } = await import('./work.js');
    handleResult(await workReadyCommand(rootOnlyContext(), opts));
  });

work
  .command('show')
  .description('Show one work item')
  .argument('<id>', 'work id')
  .option('--json', 'emit JSON')
  .action(async (id: string, opts: { json?: boolean }) => {
    const { workShowCommand } = await import('./work.js');
    handleResult(await workShowCommand(rootOnlyContext(), { id, json: opts.json }));
  });

work
  .command('claim')
  .description('Claim a ready work item')
  .argument('<id>', 'work id')
  .option('--assignee <name>', 'assignee label')
  .option('--json', 'emit JSON')
  .action(async (id: string, opts: { assignee?: string; json?: boolean }) => {
    const { workClaimCommand } = await import('./work.js');
    handleResult(
      await workClaimCommand(rootOnlyContext(), {
        id,
        assignee: opts.assignee,
        json: opts.json,
      }),
    );
  });

work
  .command('update')
  .description('Update a work item')
  .argument('<id>', 'work id')
  .option('--title <text>', 'new title')
  .option('-d, --description <text>', 'new description')
  .option('-t, --type <type>', 'task, bug, feature, epic, or chore')
  .option('-p, --priority <n>', 'priority 0-4', (v) => Number(v))
  .option('--status <status>', 'open, in_progress, blocked, or closed')
  .option('--assignee <name>', 'assignee label')
  .option('--query <text>', 'add a knowledge query', (v, acc: string[]) => [...acc, v], [])
  .option('--section <id>', 'add a section id', (v, acc: string[]) => [...acc, v], [])
  .option('--source <path>', 'add a source path', (v, acc: string[]) => [...acc, v], [])
  .option('--json', 'emit JSON')
  .action(
    async (
      id: string,
      opts: {
        title?: string;
        description?: string;
        type?: string;
        priority?: number;
        status?: string;
        assignee?: string;
        query?: string[];
        section?: string[];
        source?: string[];
        json?: boolean;
      },
    ) => {
      const { workUpdateCommand } = await import('./work.js');
      handleResult(
        await workUpdateCommand(rootOnlyContext(), {
          id,
          title: opts.title,
          description: opts.description,
          type: opts.type,
          priority: opts.priority,
          status: opts.status,
          assignee: opts.assignee,
          addQuery: opts.query,
          addSection: opts.section,
          addSource: opts.source,
          json: opts.json,
        }),
      );
    },
  );

work
  .command('close')
  .description('Close a work item')
  .argument('<id>', 'work id')
  .option('-r, --reason <text>', 'close reason')
  .option('--json', 'emit JSON')
  .action(async (id: string, opts: { reason?: string; json?: boolean }) => {
    const { workCloseCommand } = await import('./work.js');
    handleResult(
      await workCloseCommand(rootOnlyContext(), {
        id,
        reason: opts.reason,
        json: opts.json,
      }),
    );
  });

work
  .command('dep')
  .description('Add a dependency link between work items')
  .argument('<id>', 'work id')
  .option('--blocks <id>', 'this item is blocked by <id>')
  .option('--discovered-from <id>', 'this item was discovered from <id>')
  .option('--related <id>', 'related work id')
  .option('--parent-of <id>', 'this item is parent of <id>')
  .option('--json', 'emit JSON')
  .action(
    async (
      id: string,
      opts: {
        blocks?: string;
        discoveredFrom?: string;
        related?: string;
        parentOf?: string;
        json?: boolean;
      },
    ) => {
      const { workDepCommand } = await import('./work.js');
      handleResult(
        await workDepCommand(rootOnlyContext(), {
          id,
          blocks: opts.blocks,
          discoveredFrom: opts.discoveredFrom,
          related: opts.related,
          parentOf: opts.parentOf,
          json: opts.json,
        }),
      );
    },
  );

work
  .command('start')
  .description('Claim a work item and prime it from the knowledge graph')
  .argument('<id>', 'work id')
  .option('--assignee <name>', 'assignee label')
  .option('--max-tokens <n>', 'knowledge context budget', (v) => Number(v))
  .option('--json', 'emit JSON')
  .action(
    async (
      id: string,
      opts: { assignee?: string; maxTokens?: number; json?: boolean },
    ) => {
      const { workStartCommand } = await import('./work.js');
      handleResult(
        await workStartCommand(rootOnlyContext(), {
          id,
          assignee: opts.assignee,
          maxTokens: opts.maxTokens,
          json: opts.json,
        }),
      );
    },
  );

work
  .command('prime')
  .description('Print ready/in-progress work plus knowledge context for agents')
  .option('--max-tokens <n>', 'knowledge context budget', (v) => Number(v))
  .option('--json', 'emit JSON')
  .action(async (opts: { maxTokens?: number; json?: boolean }) => {
    const { workPrimeCommand } = await import('./work.js');
    handleResult(await workPrimeCommand(rootOnlyContext(), opts));
  });

work
  .command('remember')
  .description('Store a durable project memory for future prime output')
  .argument('<text>', 'memory text')
  .option('--json', 'emit JSON')
  .action(async (text: string, opts: { json?: boolean }) => {
    const { workRememberCommand } = await import('./work.js');
    handleResult(
      await workRememberCommand(rootOnlyContext(), { text, json: opts.json }),
    );
  });

work
  .command('memories')
  .description('List stored project memories')
  .option('--json', 'emit JSON')
  .action(async (opts: { json?: boolean }) => {
    const { workMemoriesCommand } = await import('./work.js');
    handleResult(await workMemoriesCommand(rootOnlyContext(), opts));
  });


const agents = program
  .command('agents')
  .description('Install or remove Code-KG guidance for coding agents');

agents
  .command('install')
  .description('Install managed AGENTS.md guidance and safe Codex hook')
  .action(async () => {
    const ctx = rootOnlyContext();
    const { agentsCommand } = await import('./agents.js');
    handleResult(await agentsCommand(ctx, { action: 'install' }));
  });

agents
  .command('uninstall')
  .description('Remove managed Code-KG agent guidance and hook entries')
  .action(async () => {
    const ctx = rootOnlyContext();
    const { agentsCommand } = await import('./agents.js');
    handleResult(await agentsCommand(ctx, { action: 'uninstall' }));
  });

agents
  .command('status')
  .description('Show Code-KG agent guidance, hook, semantic, and MCP status')
  .action(async () => {
    const ctx = rootOnlyContext();
    const { agentsCommand } = await import('./agents.js');
    handleResult(await agentsCommand(ctx, { action: 'status' }));
  });

const gitHooks = program
  .command('git-hooks')
  .description('Install or remove the Code-KG git pre-commit hook');

gitHooks
  .command('install')
  .description('Install the Code-KG pre-commit hook into this repository')
  .option('--force', 'replace an existing non-Code-KG pre-commit hook')
  .action(async (opts: { force?: boolean }) => {
    const ctx = rootOnlyContext();
    const { gitHooksCommand } = await import('./git-hooks.js');
    handleResult(
      await gitHooksCommand(ctx, { action: 'install', force: opts.force }),
    );
  });

gitHooks
  .command('uninstall')
  .description('Remove the Code-KG pre-commit hook from this repository')
  .action(async () => {
    const ctx = rootOnlyContext();
    const { gitHooksCommand } = await import('./git-hooks.js');
    handleResult(await gitHooksCommand(ctx, { action: 'uninstall' }));
  });

gitHooks
  .command('status')
  .description('Show whether the Code-KG pre-commit hook is installed')
  .action(async () => {
    const ctx = rootOnlyContext();
    const { gitHooksCommand } = await import('./git-hooks.js');
    handleResult(await gitHooksCommand(ctx, { action: 'status' }));
  });

program
  .command('hook-check')
  .description('Run the safe Code-KG agent hook check')
  .action(async () => {
    const ctx = rootOnlyContext();
    const { hookCheckCommand } = await import('./agents.js');
    handleResult(
      await hookCheckCommand(ctx, { input: await readStdinIfAvailable() }),
    );
  });

program
  .command('agent-context')
  .argument('<event>', 'session, prompt, edit, or stop')
  .description('Supply bounded, local-only context to agent lifecycle hooks')
  .action(async (event) => {
    const { agentContextCommand } = await import('./agent-context.js');
    handleResult(
      await agentContextCommand(
        rootOnlyContext(),
        event,
        (await readStdinIfAvailable()) ?? '',
      ),
    );
  });

program
  .command('session-check')
  .description('Run the safe Code-KG SessionStart bootstrap-offer check')
  .action(async () => {
    const ctx = rootOnlyContext();
    const { sessionCheckCommand } = await import('./agents.js');
    handleResult(
      await sessionCheckCommand(ctx, { input: await readStdinIfAvailable() }),
    );
  });

program
  .command('mcp')
  .description('Start the MCP server')
  .action(async () => {
    const { startCodeKgMcpServer } = await import('./mcp.js');
    await startCodeKgMcpServer();
  });

program
  .command('review-source')
  .argument('<section-stable-id>')
  .description(
    'Explicitly acknowledge source review and preserve a section as curated',
  )
  .option('--write', 'Record the reviewed source hashes; default is preview')
  .action(async (id, opts) => {
    const { reviewSourceCommand } = await import('./review-source.js');
    handleResult(
      await reviewSourceCommand(rootOnlyContext(), id, opts.write === true),
    );
  });

program
  .command('ask')
  .description(
    'Search reviewed knowledge and fresh source with lexical, semantic, and graph ranking',
  )
  .argument('<query>')
  .option('--workspace', 'Search explicitly registered repositories')
  .option('--in <path>', 'Limit source scope')
  .option('--limit <count>', 'Maximum hits', parsePositiveInteger, 8)
  .option(
    '--max-tokens <count>',
    'Approximate output budget',
    parsePositiveInteger,
    3000,
  )
  .option('--no-source', 'Return pointers instead of source excerpts')
  .option('--no-semantic', 'Use only local lexical and graph ranking')
  .option('--json', 'Return structured results')
  .action(async (query, opts) => {
    const { ask, formatQuery } = await import('./query.js');
    const { askWorkspace } = await import('./workspace.js');
    const result = await (opts.workspace ? askWorkspace : ask)(
      rootOnlyContext().projectRoot,
      query,
      opts,
    );
    console.log(opts.json ? JSON.stringify(result) : formatQuery(result, opts));
  });
const workspace = program
  .command('workspace')
  .description('Manage explicit local multi-repository search roots');
workspace
  .command('add')
  .argument('<directories...>')
  .action(async (directories) => {
    const { workspaceCommand } = await import('./workspace.js');
    handleResult(await workspaceCommand(rootOnlyContext(), 'add', directories));
  });
workspace.command('list').action(async () => {
  const { workspaceCommand } = await import('./workspace.js');
  handleResult(await workspaceCommand(rootOnlyContext(), 'list'));
});
workspace
  .command('remove')
  .argument('<names...>')
  .action(async (names) => {
    const { workspaceCommand } = await import('./workspace.js');
    handleResult(await workspaceCommand(rootOnlyContext(), 'remove', names));
  });
for (const name of ['callers', 'callees', 'impact']) {
  program
    .command(name)
    .argument('<symbol-or-file>')
    .option(
      '--depth <count>',
      'Traversal depth or all',
      (value) => (value === 'all' ? Infinity : parsePositiveInteger(value)),
      name === 'impact' ? Infinity : 1,
    )
    .option('--in <path>', 'Limit traversal to scope')
    .option(
      '--max-tokens <count>',
      'Approximate output budget',
      parsePositiveInteger,
      3000,
    )
    .option('--json', 'Return structured results')
    .action(async (query, opts) => {
      const { trace, traceCommand } = await import('./query.js');
      const options = {
        ...opts,
        direction: name === 'callees' ? ('out' as const) : ('in' as const),
      };
      if (opts.json)
        console.log(
          JSON.stringify(
            await trace(rootOnlyContext().projectRoot, query, options),
          ),
        );
      else handleResult(await traceCommand(rootOnlyContext(), query, options));
    });
}
program
  .command('map')
  .description('Show a bounded repository map and dependency hotspots')
  .option('--in <path>')
  .option(
    '--max-tokens <count>',
    'Approximate output budget',
    parsePositiveInteger,
    3000,
  )
  .action(async (opts) => {
    const { mapCommand } = await import('./query.js');
    handleResult(await mapCommand(rootOnlyContext(), opts));
  });
program
  .command('skeleton')
  .argument('<file>')
  .description('Show a source file API without reading its entire body')
  .option(
    '--max-tokens <count>',
    'Approximate output budget',
    parsePositiveInteger,
    3000,
  )
  .action(async (file, opts) => {
    const { skeletonCommand } = await import('./query.js');
    handleResult(await skeletonCommand(rootOnlyContext(), file, opts));
  });
program
  .command('grep')
  .argument('<pattern>')
  .description('Find all occurrences in indexed source files')
  .option('--in <path>')
  .option('--regex', 'Interpret the pattern as a ripgrep regex')
  .option('-i, --ignore-case')
  .option(
    '--max-tokens <count>',
    'Approximate output budget',
    parsePositiveInteger,
    3000,
  )
  .action(async (pattern, opts) => {
    const { grepCommand } = await import('./query.js');
    handleResult(await grepCommand(rootOnlyContext(), pattern, opts));
  });

await program.parseAsync();
