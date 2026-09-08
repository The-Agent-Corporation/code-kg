import type { CmdContext, CmdResult } from '../context.js';
import { getEmbeddingKey, getLlmKey } from '../config.js';
import { runIndex } from '../cli/search.js';
import { createBootstrapPlan, writeBootstrapPlan } from './bootstrap.js';
import { codeKgCheckCommand } from './check.js';
import { driftCommand } from './drift.js';
import { enrichCommand } from './enrich.js';

export async function updateCommand(ctx: CmdContext): Promise<CmdResult> {
  const plan = await createBootstrapPlan(ctx.projectRoot);
  const changes = await writeBootstrapPlan(plan);
  const lines = ['# Code-KG Update', '', '- materialized knowledge base'];
  lines.push(...changes.slice(0, 12).map((change) => `  - ${change}`));
  if (changes.length > 12) {
    lines.push(`  - and ${changes.length - 12} more changes`);
  }

  if (getLlmKey()) {
    const enrich = await enrichCommand(ctx);
    lines.push('', enrich.output);
  } else {
    lines.push(
      '- llm enrich: skipped (set LAT_LLM_KEY / config llm_key for LLM summaries)',
    );
  }

  try {
    const key = getEmbeddingKey();
    if (key) {
      await runIndex(ctx.latDir, key);
      lines.push('- semantic reindex: completed');
    } else {
      lines.push('- semantic reindex: skipped (no provider configured)');
    }
  } catch (error) {
    lines.push(`- semantic reindex: skipped (${(error as Error).message})`);
  }

  const check = await codeKgCheckCommand(ctx);
  lines.push(
    check.isError ? '- code-kg check: failed' : '- code-kg check: passed',
  );
  const drift = await driftCommand(ctx);
  lines.push('', drift.output);
  return {
    output: lines.join('\n'),
    isError: check.isError || drift.isError,
  };
}
