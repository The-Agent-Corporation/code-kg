import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CmdContext, CmdResult } from '../context.js';
import {
  getConfigPath,
  getEmbeddingKey,
  saveLocalEmbeddingConfig,
} from '../config.js';
import { runIndex } from '../cli/search.js';
import { closeDb, indexedModel, openDb } from '../search/db.js';
import {
  DEFAULT_LOCAL_EMBEDDING_DIMENSIONS,
  DEFAULT_LOCAL_EMBEDDING_MODEL,
  detectProvider,
  providerModelId,
  resolveLocalEmbeddingModel,
  type EmbeddingProvider,
} from '../search/provider.js';

export type SemanticAction = 'status' | 'enable-local' | 'reindex';

export type SemanticOptions = {
  action: SemanticAction;
  /** For enable-local: small, base, or a Hugging Face model id. */
  model?: string;
  dimensions?: number;
};

type SemanticSummary =
  | {
      state: 'missing';
      cachePresent: boolean;
    }
  | {
      state: 'configured';
      cachePresent: boolean;
      provider: EmbeddingProvider;
    }
  | {
      state: 'invalid';
      message: string;
    };

function vectorCachePresent(ctx: CmdContext): boolean {
  return existsSync(join(ctx.latDir, '.cache', 'vectors.db'));
}

function semanticSummary(ctx: CmdContext): SemanticSummary {
  try {
    const key = getEmbeddingKey();
    if (!key) {
      return { state: 'missing', cachePresent: vectorCachePresent(ctx) };
    }
    return {
      state: 'configured',
      cachePresent: vectorCachePresent(ctx),
      provider: detectProvider(key),
    };
  } catch (error) {
    return { state: 'invalid', message: (error as Error).message };
  }
}

function providerLabel(provider: EmbeddingProvider): string {
  if (provider.kind === 'local') {
    return `local (${provider.model}, ${provider.dimensions}d)`;
  }
  return `remote ${provider.name} (${provider.model}, ${provider.dimensions}d)`;
}

function cacheLabel(cachePresent: boolean): string {
  return cachePresent ? 'present' : 'missing';
}

export function semanticDoctorStatus(ctx: CmdContext): string {
  const summary = semanticSummary(ctx);
  if (summary.state === 'invalid') {
    return `- semantic search: invalid (${summary.message})`;
  }
  if (summary.state === 'missing') {
    return summary.cachePresent
      ? '- semantic search: missing (vector cache present; run `code-kg semantic enable-local`)'
      : '- semantic search: missing';
  }
  if (summary.provider.kind === 'local') {
    return `- semantic search: local (${summary.provider.model}, ${summary.provider.dimensions}d, cache ${cacheLabel(summary.cachePresent)})`;
  }
  return `- semantic search: ${providerLabel(summary.provider)}`;
}

function formatStatus(ctx: CmdContext): string {
  const summary = semanticSummary(ctx);
  const lines = [
    '# Code-KG Semantic Search',
    '',
    `- config: ${getConfigPath()}`,
  ];

  if (summary.state === 'invalid') {
    lines.push(`- provider: invalid (${summary.message})`);
    return lines.join('\n');
  }

  if (summary.state === 'missing') {
    lines.push(
      summary.cachePresent
        ? '- provider: missing (vector cache exists; run `code-kg semantic enable-local`)'
        : '- provider: missing',
    );
    lines.push(`- vector cache: ${cacheLabel(summary.cachePresent)}`);
    return lines.join('\n');
  }

  lines.push(`- provider: ${providerLabel(summary.provider)}`);
  lines.push(`- vector cache: ${cacheLabel(summary.cachePresent)}`);
  return lines.join('\n');
}

async function cacheModel(ctx: CmdContext): Promise<string | undefined> {
  if (!vectorCachePresent(ctx)) return undefined;
  const db = openDb(ctx.latDir);
  try {
    return await indexedModel(db);
  } finally {
    await closeDb(db);
  }
}

async function formatEnableLocal(ctx: CmdContext): Promise<string> {
  const provider = detectProvider('local');
  const cachePresent = vectorCachePresent(ctx);
  const built = await cacheModel(ctx);
  return [
    '# Code-KG Semantic Search',
    '',
    '- local embeddings enabled',
    `- config: ${getConfigPath()}`,
    `- provider: ${providerLabel(provider)}`,
    `- vector cache: ${cacheLabel(cachePresent)}${
      built && built !== providerModelId(provider)
        ? ` (built with ${built}; rebuilt on the next search or \`code-kg semantic reindex\`)`
        : ''
    }`,
    `- default model: ${DEFAULT_LOCAL_EMBEDDING_MODEL} (${DEFAULT_LOCAL_EMBEDDING_DIMENSIONS}d)`,
  ].join('\n');
}

export async function semanticCommand(
  ctx: CmdContext,
  opts: SemanticOptions,
): Promise<CmdResult> {
  if (opts.action === 'status') {
    return { output: formatStatus(ctx) };
  }

  if (opts.action === 'enable-local') {
    let model: ReturnType<typeof resolveLocalEmbeddingModel> | undefined;
    try {
      model =
        opts.model === undefined
          ? undefined
          : resolveLocalEmbeddingModel(opts.model, opts.dimensions);
    } catch (error) {
      return { output: (error as Error).message, isError: true };
    }
    try {
      saveLocalEmbeddingConfig(model);
    } catch (error) {
      return {
        output: `${(error as Error).message}\nFix or remove the config file, then run \`code-kg semantic enable-local\` again.`,
        isError: true,
      };
    }
    return { output: await formatEnableLocal(ctx) };
  }

  let key: string | undefined;
  try {
    key = getEmbeddingKey();
  } catch (error) {
    return { output: (error as Error).message, isError: true };
  }
  if (!key) {
    return {
      output:
        'No semantic embedding provider configured. Run `code-kg semantic enable-local` to use local embeddings.',
      isError: true,
    };
  }

  await runIndex(ctx.latDir, key);
  return {
    output: [
      '# Code-KG Semantic Search',
      '',
      '- reindexed semantic vector cache',
      `- vector cache: ${join(ctx.latDir, '.cache', 'vectors.db')}`,
    ].join('\n'),
  };
}
