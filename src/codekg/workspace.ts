import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import type { CmdContext, CmdResult } from '../context.js';
import { writeJsonAtomic } from './cache.js';
import {
  ask,
  formatQuery,
  withinScope,
  type QueryOptions,
  type QueryResult,
} from './query.js';

type Workspace = { version: 1; repositories: { name: string; path: string }[] };
export const workspacePath = (root: string) =>
  join(root, '.code-kg/workspace.json');
async function readWorkspace(root: string): Promise<Workspace | null> {
  let text: string;
  try {
    text = await readFile(workspacePath(root), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  const data = JSON.parse(text) as Workspace;
  if (
    data.version !== 1 ||
    !Array.isArray(data.repositories) ||
    data.repositories.some(
      (r) =>
        !r ||
        typeof r.name !== 'string' ||
        !/^[a-zA-Z0-9_-]+$/.test(r.name) ||
        typeof r.path !== 'string' ||
        isAbsolute(r.path),
    )
  )
    throw new Error('Invalid Code-KG workspace configuration.');
  if (
    new Set(data.repositories.map((r) => r.name)).size !==
    data.repositories.length
  )
    throw new Error('Workspace repository names must be unique.');
  return data;
}
export async function workspaceCommand(
  ctx: CmdContext,
  action: 'add' | 'list' | 'remove',
  directories: string[] = [],
): Promise<CmdResult> {
  const config = (await readWorkspace(ctx.projectRoot)) ?? {
    version: 1,
    repositories: [],
  };
  if (action === 'add') {
    for (const directory of directories) {
      const path = await realpath(resolve(ctx.projectRoot, directory));
      if (!(await stat(path)).isDirectory())
        throw new Error('Not a repository directory: ' + directory);
      const name = basename(path).replace(/[^a-zA-Z0-9_-]/g, '-');
      const prior = config.repositories.find((r) => r.name === name);
      const local = relative(await realpath(ctx.projectRoot), path) || '.';
      if (prior && prior.path !== local)
        throw new Error('Duplicate workspace name: ' + name);
      if (!prior) config.repositories.push({ name, path: local });
    }
    await writeJsonAtomic(workspacePath(ctx.projectRoot), config);
  } else if (action === 'remove') {
    config.repositories = config.repositories.filter(
      (r) => !directories.includes(r.name),
    );
    await writeJsonAtomic(workspacePath(ctx.projectRoot), config);
  }
  return {
    output: [
      '# Code-KG Workspace',
      '',
      ...config.repositories.map((r) => '- ' + r.name + ': ' + r.path),
      ...(config.repositories.length ? [] : ['No repositories registered.']),
    ].join('\n'),
  };
}

export async function askWorkspace(
  root: string,
  query: string,
  opts: QueryOptions = {},
): Promise<QueryResult> {
  withinScope('', opts.in);
  const config = await readWorkspace(root);
  if (!config?.repositories.length)
    throw new Error(
      'Register repositories with code-kg workspace add <directories...>.',
    );
  const hits: QueryResult['hits'] = [],
    warnings: string[] = [];
  let successful = 0;
  for (const repository of config.repositories) {
    if (
      opts.in &&
      opts.in !== '.' &&
      opts.in !== repository.name &&
      !opts.in.startsWith(repository.name + '/')
    )
      continue;
    try {
      const path = resolve(root, repository.path);
      if (!(await stat(path)).isDirectory())
        throw new Error('repository is not a directory');
      const scope = opts.in?.startsWith(repository.name + '/')
        ? opts.in.slice(repository.name.length + 1)
        : undefined;
      const result = await ask(path, query, { ...opts, in: scope });
      successful++;
      // Rank fusion uses result rank, not incomparable per-repository scores.
      result.hits.forEach((hit, i) =>
        hits.push({
          ...hit,
          id: repository.name + '::' + hit.id,
          path: repository.name + '/' + hit.path,
          title: '[' + repository.name + '] ' + hit.title,
          score: 1 / (60 + i + 1),
        }),
      );
      warnings.push(...result.warnings.map((w) => repository.name + ': ' + w));
    } catch (error) {
      warnings.push(repository.name + ': ' + (error as Error).message);
    }
  }
  if (!successful)
    throw new Error(
      warnings.join('\n') || 'No repository matches the workspace scope.',
    );
  hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {
    query,
    hits: hits.slice(0, opts.limit ?? 8),
    warnings,
    backend: 'workspace rank fusion across ' + successful + ' repositories',
  };
}
export async function workspaceAskCommand(
  ctx: CmdContext,
  query: string,
  opts: QueryOptions = {},
): Promise<CmdResult> {
  return {
    output: formatQuery(await askWorkspace(ctx.projectRoot, query, opts), opts),
  };
}
