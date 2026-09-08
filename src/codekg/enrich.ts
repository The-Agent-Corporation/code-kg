/**
 * LLM enrichment for generated lat.md leading paragraphs.
 *
 * Bootstrap remains deterministic; this opt-in step rewrites section summaries
 * with a chat model when LAT_LLM_KEY / config llm_key is set (OpenRouter
 * `sk-or-...`, OpenAI `sk-...`, or Anthropic `sk-ant-...`).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { readJson } from './cache.js';
import { sourceHash } from './structural.js';
import type { MaterializationManifest } from './types.js';
import type { CmdContext, CmdResult } from '../context.js';
import { getLlmKey } from '../config.js';
import {
  flattenSections,
  listLatticeFiles,
  parseSections,
} from '../lattice.js';
import {
  LEADING_PARAGRAPH_MAX,
  bodyTextLength,
  clampLeadingParagraph,
} from './limits.js';

type ChatProvider = {
  name: string;
  url: string;
  model: string;
  headers: (key: string) => Record<string, string>;
  body: (model: string, system: string, user: string) => unknown;
  extract: (json: any) => string | undefined;
};

const OPENROUTER: ChatProvider = {
  name: 'openrouter',
  url: 'https://openrouter.ai/api/v1/chat/completions',
  model: process.env.CODEKG_SUMMARY_MODEL?.trim() || 'openai/gpt-4.1-mini',
  headers: (key) => ({
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/The-Agent-Corporation/code-kg',
    'X-Title': 'code-kg enrich',
  }),
  body: (model, system, user) => ({
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }),
  extract: (json) => json?.choices?.[0]?.message?.content,
};

const OPENAI: ChatProvider = {
  name: 'openai',
  url: 'https://api.openai.com/v1/chat/completions',
  model: process.env.CODEKG_SUMMARY_MODEL?.trim() || 'gpt-4.1-mini',
  headers: (key) => ({
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }),
  body: (model, system, user) => ({
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }),
  extract: (json) => json?.choices?.[0]?.message?.content,
};

const ANTHROPIC: ChatProvider = {
  name: 'anthropic',
  url: 'https://api.anthropic.com/v1/messages',
  model: process.env.CODEKG_SUMMARY_MODEL?.trim() || 'claude-sonnet-4-20250514',
  headers: (key) => ({
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  }),
  body: (model, system, user) => ({
    model,
    max_tokens: 200,
    system,
    messages: [{ role: 'user', content: user }],
  }),
  extract: (json) => {
    const block = json?.content?.find((b: any) => b?.type === 'text');
    return typeof block?.text === 'string' ? block.text : undefined;
  },
};

const XAI: ChatProvider = {
  name: 'xai',
  url: 'https://api.x.ai/v1/chat/completions',
  model:
    process.env.CODEKG_SUMMARY_MODEL?.trim() || 'grok-4-fast-non-reasoning',
  headers: (key) => ({
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }),
  body: (model, system, user) => ({
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }),
  extract: (json) => json?.choices?.[0]?.message?.content,
};

function detectChatProvider(key: string): ChatProvider {
  if (key.startsWith('sk-or-')) return OPENROUTER;
  if (key.startsWith('sk-ant-')) return ANTHROPIC;
  if (key.startsWith('xai-') || key.startsWith('eyJ')) return XAI;
  if (key.startsWith('sk-')) return OPENAI;
  throw new Error(
    'Unrecognized LAT_LLM_KEY for summaries. Supported: OpenRouter (sk-or-...), OpenAI (sk-...), Anthropic (sk-ant-...), xAI (xai-... or OAuth JWT).',
  );
}

const SYSTEM = `You write brief Code-KG section summaries for AI coding agents.
Return ONLY one plain-text paragraph of at most ${LEADING_PARAGRAPH_MAX} characters.
No markdown headings, no bullet lists, no quotes around the paragraph.
Summarize what the section documents and why an agent would open it.`;

async function chatSummary(
  provider: ChatProvider,
  key: string,
  user: string,
): Promise<string> {
  const response = await fetch(provider.url, {
    method: 'POST',
    headers: provider.headers(key),
    body: JSON.stringify(provider.body(provider.model, SYSTEM, user)),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${provider.name} HTTP ${response.status}: ${text.slice(0, 240)}`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${provider.name} returned non-JSON`);
  }
  const content = provider.extract(json)?.trim();
  if (!content) throw new Error(`${provider.name} returned empty summary`);
  return clampLeadingParagraph(content.replace(/\s+/g, ' '));
}

function shouldEnrich(paragraph: string): boolean {
  return (
    /^(Source file|Test file|Entry point) `/.test(paragraph) ||
    paragraph.includes('deterministic file, symbol, and import extraction') ||
    paragraph.includes('seeded from deterministic import relationships') ||
    paragraph.includes(
      'summarizes the repository shape discovered during the first Code-KG bootstrap',
    ) ||
    paragraph.includes('Treat this as a starting map') ||
    paragraph.includes('Code-KG extracted a deterministic structural graph') ||
    bodyTextLength(paragraph) > LEADING_PARAGRAPH_MAX
  );
}

function sectionSnippet(
  fileLines: string[],
  startLine: number,
  endLine: number,
): string {
  const start = Math.max(0, startLine - 1);
  const end = Math.min(fileLines.length, Math.max(start + 1, endLine));
  return fileLines
    .slice(start, Math.min(end, start + 40))
    .join('\n')
    .slice(0, 1200);
}

export async function enrichCommand(ctx: CmdContext): Promise<CmdResult> {
  const lines = ['# Code-KG Enrich', ''];
  const key = getLlmKey();
  if (!key) {
    return {
      output: [
        ...lines,
        '- skipped: no LAT_LLM_KEY / config llm_key (OpenRouter sk-or-..., OpenAI sk-..., or Anthropic sk-ant-...)',
        '- deterministic bootstrap summaries remain in place',
      ].join('\n'),
      isError: true,
    };
  }

  let provider: ChatProvider;
  try {
    provider = detectChatProvider(key);
  } catch (error) {
    return {
      output: [...lines, `- skipped: ${(error as Error).message}`].join('\n'),
      isError: true,
    };
  }

  lines.push(`- provider: ${provider.name} (${provider.model})`);

  const files = await listLatticeFiles(ctx.latDir);
  const manifest = await readJson<MaterializationManifest>(
    join(ctx.projectRoot, '.code-kg/materialization-manifest.json'),
  );
  let rewritten = 0;
  let skipped = 0;
  let failed = 0;
  const maxRewrites = Number(process.env.CODEKG_ENRICH_LIMIT ?? 40);

  // Prefer overview / community prose before per-file highlights.
  const work: {
    file: string;
    original: string;
    section: ReturnType<typeof flattenSections>[number];
  }[] = [];

  for (const file of files) {
    const original = await readFile(file, 'utf-8');
    const owner = Object.values(manifest?.sections ?? {}).find(
      (s) => s.file === relative(ctx.projectRoot, file),
    );
    if (
      !owner ||
      owner.status !== 'generated' ||
      owner.generated_hash !== sourceHash(original)
    ) {
      skipped++;
      continue;
    }
    const sections = flattenSections(
      parseSections(file, original, ctx.projectRoot),
    );
    for (const section of sections) {
      const paragraph = section.firstParagraph?.trim();
      if (!paragraph || !shouldEnrich(paragraph)) {
        skipped++;
        continue;
      }
      work.push({ file, original, section });
    }
  }

  work.sort((a, b) => {
    const score = (id: string) => {
      if (id.includes('overview') || id.endsWith('#Architecture')) return 0;
      if (id.includes('Communities') || id.includes('Structural')) return 1;
      if (id.includes('Repository Snapshot') || id.includes('Cross-Cutting'))
        return 2;
      if (id.includes('Source File Highlights') || id.includes('Source Test'))
        return 4;
      return 3;
    };
    return score(a.section.id) - score(b.section.id);
  });

  const byFile = new Map<string, string>();
  for (const item of work) {
    if (!byFile.has(item.file)) byFile.set(item.file, item.original);
  }

  for (const item of work) {
    if (rewritten >= maxRewrites) {
      skipped++;
      continue;
    }
    const paragraph = item.section.firstParagraph.trim();
    const fileLines = (byFile.get(item.file) ?? item.original).split('\n');
    const user = [
      `Section id: ${item.section.id}`,
      `Heading: ${item.section.heading}`,
      `File: ${relative(ctx.projectRoot, item.file)}`,
      '',
      'Current leading paragraph:',
      paragraph,
      '',
      'Section body (context):',
      sectionSnippet(fileLines, item.section.startLine, item.section.endLine),
    ].join('\n');

    try {
      const summary = await chatSummary(provider, key, user);
      if (summary === paragraph) {
        skipped++;
        continue;
      }
      let next = byFile.get(item.file) ?? item.original;
      const at = next.indexOf(paragraph);
      if (at < 0) {
        skipped++;
        continue;
      }
      next = next.slice(0, at) + summary + next.slice(at + paragraph.length);
      byFile.set(item.file, next);
      rewritten++;
    } catch (error) {
      failed++;
      lines.push(
        `- failed ${item.section.id}: ${(error as Error).message.slice(0, 160)}`,
      );
      // Auth failures won't recover mid-run.
      if (/HTTP 401|HTTP 403/.test((error as Error).message)) break;
    }
  }

  for (const [file, next] of byFile) {
    const original = work.find((w) => w.file === file)?.original;
    if (original !== undefined && next !== original) {
      if ((await readFile(file, 'utf8')) !== original) {
        failed++;
        lines.push(
          '- skipped concurrent edit: ' + relative(ctx.projectRoot, file),
        );
        continue;
      }
      await writeFile(file, next.endsWith('\n') ? next : `${next}\n`, 'utf-8');
      lines.push(`- updated ${relative(ctx.projectRoot, file)}`);
    }
  }

  lines.push(
    `- rewritten: ${rewritten}`,
    `- skipped: ${skipped}`,
    `- failed: ${failed}`,
  );

  return {
    output: lines.join('\n'),
    isError: failed > 0 && rewritten === 0,
  };
}
