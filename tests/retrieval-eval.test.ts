import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Client } from '@libsql/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rankSectionsLexically } from '../src/codekg/search.js';
import {
  flattenSections,
  loadAllSections,
  type Section,
} from '../src/lattice.js';
import { closeDb, ensureSchema, openDb } from '../src/search/db.js';
import { indexSections } from '../src/search/index.js';
import { detectProvider } from '../src/search/provider.js';
import { searchSections } from '../src/search/search.js';

/**
 * Questions an agent asks about this repository, each with the sections of
 * its committed knowledge base that answer it. Any listed id counts as a hit.
 */
const A = 'lat.md/architecture#Architecture#';
const T = 'lat.md/tests/tests#Tests#';
const QUESTIONS: Array<{ question: string; answers: string[] }> = [
  {
    question:
      'how are human edits preserved when the knowledge base is regenerated',
    answers: [
      `${A}Source File Highlights#src/codekg/bootstrap.ts`,
      `${A}Dependency Hotspots#src/codekg/bootstrap.ts`,
    ],
  },
  {
    question: 'what does edit-safe mean for a section',
    answers: [
      `${A}Dependency Hotspots#src/codekg/types.ts`,
      `${T}Test Coverage Links#src/codekg/backlinks.ts`,
    ],
  },
  {
    question: 'when does drift report a warning',
    answers: [`${T}Test Coverage Links#src/codekg/drift.ts`],
  },
  {
    question: 'how do I acknowledge that a section was reviewed against source',
    answers: [`${T}Test Coverage Links#src/codekg/review-source.ts`],
  },
  {
    question: 'how does apply-backlinks insert @lat comments into source files',
    answers: [
      `${T}Test Coverage Links#src/codekg/backlinks.ts`,
      `${T}Source Test Highlights#tests/backlinks-safety.test.ts`,
    ],
  },
  {
    question: 'what happens when no embedding provider is configured',
    answers: [
      `${T}Test Coverage Links#src/codekg/search.ts`,
      `${T}Test Coverage Links#src/config.ts`,
      `${A}Dependency Hotspots#src/config.ts`,
      `${T}Source Test Highlights#tests/search-fallback.test.ts`,
    ],
  },
  {
    question: 'which search backends can code-kg search use',
    answers: [
      `${T}Test Coverage Links#src/codekg/search.ts`,
      `${T}Source Test Highlights#tests/search-fallback.test.ts`,
    ],
  },
  {
    question: 'how are inferred test edges different from extracted imports',
    answers: [
      `${A}Source File Highlights#src/codekg/graph.ts`,
      `${A}Dependency Hotspots#src/codekg/graph.ts`,
      `${T}Source Test Highlights#tests/gaps-inferred.test.ts`,
      'lat.md/confidence#Confidence Review',
    ],
  },
  {
    question: 'what does the pre-commit hook do',
    answers: [`${T}Source Test Highlights#tests/git-hooks.test.ts`],
  },
  {
    question: 'how is the AGENTS.md guidance block installed',
    answers: [
      `${A}Source File Highlights#src/codekg/agents.ts`,
      `${T}Test Coverage Links#src/codekg/agents.ts`,
      `${T}Source Test Highlights#tests/agents-edge-cases.test.ts`,
    ],
  },
  {
    question: 'where is the MCP server defined',
    answers: [
      `${T}Test Coverage Links#src/codekg/mcp.ts`,
      `${T}Source Test Highlights#tests/mcp.test.ts`,
    ],
  },
  {
    question: 'how is the structural graph extracted from source code',
    answers: [
      `${A}Structural Graph`,
      `${A}Source File Highlights#src/codekg/graph.ts`,
      `${A}Dependency Hotspots#src/codekg/graph.ts`,
      `${A}Dependency Hotspots#src/codekg/structural.ts`,
    ],
  },
  {
    question: 'where are the code-kg CLI commands registered',
    answers: [
      `${A}Source File Highlights#src/codekg/cli.ts`,
      `${A}Entry Points`,
    ],
  },
  {
    question: 'how are wiki links between sections validated',
    answers: [
      `${A}Source File Highlights#src/cli/check.ts`,
      `${T}Test Coverage Links#src/cli/check.ts`,
      'lat.md/tests/check-md#Check Md Tests',
    ],
  },
  {
    question: 'what is the materialization manifest',
    answers: [
      `${A}Dependency Hotspots#src/codekg/types.ts`,
      `${A}Source File Highlights#src/codekg/bootstrap.ts`,
    ],
  },
  {
    question: 'how does a hook read its payload from stdin',
    answers: [`${T}Source Test Highlights#tests/hook-stdin.test.ts`],
  },
];

/**
 * Measured on the committed knowledge base. Raise these when ranking or
 * curated sections improve; lowering one needs a reason in the commit.
 */
const LEXICAL_FLOOR = { recallAt5: 0.25, mrr: 0.17 };
const SEMANTIC_FLOOR = { recallAt5: 0.625, mrr: 0.469 };

type Score = { recallAt5: number; mrr: number; report: string };

function score(rankings: string[][]): Score {
  let hits = 0;
  let reciprocal = 0;
  const lines = QUESTIONS.map(({ question, answers }, index) => {
    const rank = rankings[index].findIndex((id) => answers.includes(id)) + 1;
    if (rank >= 1 && rank <= 5) hits++;
    if (rank >= 1) reciprocal += 1 / rank;
    return `${rank ? `#${rank}` : 'miss'}\t${question}`;
  });
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    recallAt5: round(hits / QUESTIONS.length),
    mrr: round(reciprocal / QUESTIONS.length),
    report: lines.join('\n'),
  };
}

const repoLatDir = join(import.meta.dirname, '..', 'lat.md');
let sections: Section[];

beforeAll(async () => {
  sections = flattenSections(await loadAllSections(repoLatDir));
});

describe('retrieval eval (lexical)', () => {
  it('names only sections that exist', () => {
    const ids = new Set(sections.map((section) => section.id));
    const missing = QUESTIONS.flatMap(({ answers }) => answers).filter(
      (id) => !ids.has(id),
    );
    expect(missing).toStrictEqual([]);
  });

  it('stays at or above the recorded floor', () => {
    const result = score(
      QUESTIONS.map(({ question }) =>
        rankSectionsLexically(sections, question, 10).map(
          (section) => section.id,
        ),
      ),
    );

    expect(result.recallAt5, result.report).toBeGreaterThanOrEqual(
      LEXICAL_FLOOR.recallAt5,
    );
    expect(result.mrr, result.report).toBeGreaterThanOrEqual(LEXICAL_FLOOR.mrr);
    console.info(
      `lexical recall@5=${result.recallAt5} mrr=${result.mrr}\n${result.report}`,
    );
  });
});

describe.skipIf(process.env.LAT_TEST_LOCAL_EMBEDDINGS !== '1')(
  'retrieval eval (local embeddings)',
  () => {
    let tmp: string;
    let db: Client;

    beforeAll(async () => {
      tmp = mkdtempSync(join(tmpdir(), 'codekg-retrieval-eval-'));
      cpSync(repoLatDir, join(tmp, 'lat.md'), { recursive: true });
      db = openDb(join(tmp, 'lat.md'));
      await ensureSchema(db, detectProvider('local').dimensions);
      await indexSections(
        join(tmp, 'lat.md'),
        db,
        detectProvider('local'),
        'local',
      );
    }, 300_000);

    afterAll(async () => {
      if (db) await closeDb(db);
      if (tmp) rmSync(tmp, { recursive: true, force: true });
    });

    it('stays at or above the recorded floor', async () => {
      const provider = detectProvider('local');
      const rankings: string[][] = [];
      for (const { question } of QUESTIONS) {
        const results = await searchSections(
          db,
          question,
          provider,
          'local',
          10,
        );
        rankings.push(results.map((result) => result.id));
      }
      const result = score(rankings);
      console.info(
        `semantic recall@5=${result.recallAt5} mrr=${result.mrr}\n${result.report}`,
      );
      expect(result.recallAt5, result.report).toBeGreaterThanOrEqual(
        SEMANTIC_FLOOR.recallAt5,
      );
      expect(result.mrr, result.report).toBeGreaterThanOrEqual(
        SEMANTIC_FLOOR.mrr,
      );
    }, 300_000);
  },
);
