import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Client } from '@libsql/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ask, type QueryHit } from '../src/codekg/query.js';
import {
  rankSectionsLexically,
  readSectionBodies,
} from '../src/codekg/search.js';
import type { MaterializationManifest } from '../src/codekg/types.js';
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
const C = 'lat.md/concepts#Concepts#';
const F = 'lat.md/files#Source Files#';
const QUESTIONS: Array<{ question: string; answers: string[] }> = [
  {
    question:
      'how are human edits preserved when the knowledge base is regenerated',
    answers: [`${C}Merge-Safe Materialization`, `${F}src/codekg/bootstrap.ts`],
  },
  {
    question: 'what does edit-safe mean for a section',
    answers: [
      `${C}Source Anchor Policies`,
      `${F}src/codekg/types.ts`,
      `${F}src/codekg/backlinks.ts`,
    ],
  },
  {
    question: 'when does drift report a warning',
    answers: [`${C}Drift and Source Review`, `${F}src/codekg/drift.ts`],
  },
  {
    question: 'how do I acknowledge that a section was reviewed against source',
    answers: [`${C}Drift and Source Review`, `${F}src/codekg/review-source.ts`],
  },
  {
    question: 'how does a curated section become edit-safe',
    answers: [`${C}Section Anchors`, `${C}Source Anchor Policies`],
  },
  {
    question: 'how does apply-backlinks insert @lat comments into source files',
    answers: [
      `${C}Source Anchor Policies`,
      `${F}src/codekg/backlinks.ts`,
      `${F}tests/backlinks-safety.test.ts`,
    ],
  },
  {
    question: 'what happens when no embedding provider is configured',
    answers: [
      `${C}Search Backends`,
      `${F}src/codekg/search.ts`,
      `${F}src/config.ts`,
      `${F}tests/search-fallback.test.ts`,
    ],
  },
  {
    question: 'which search backends can code-kg search use',
    answers: [
      `${C}Search Backends`,
      `${F}src/codekg/search.ts`,
      `${F}tests/search-fallback.test.ts`,
    ],
  },
  {
    question: 'how are inferred test edges different from extracted imports',
    answers: [
      `${C}Relationship Confidence`,
      `${F}src/codekg/graph.ts`,
      `${F}tests/gaps-inferred.test.ts`,
      'lat.md/confidence#Confidence Review',
    ],
  },
  {
    question: 'what does the pre-commit hook do',
    answers: [`${C}Agent Guidance and Hooks`, `${F}tests/git-hooks.test.ts`],
  },
  {
    question: 'how is the AGENTS.md guidance block installed',
    answers: [
      `${C}Agent Guidance and Hooks`,
      `${F}src/codekg/agents.ts`,
      `${F}tests/agents-edge-cases.test.ts`,
    ],
  },
  {
    question: 'where is the MCP server defined',
    answers: [`${F}src/codekg/mcp.ts`, `${F}tests/mcp.test.ts`],
  },
  {
    question: 'how is the structural graph extracted from source code',
    answers: [
      `${C}Structural Extraction`,
      `${A}Structural Graph`,
      `${F}src/codekg/graph.ts`,
      `${F}src/codekg/structural.ts`,
    ],
  },
  {
    question: 'where are the code-kg CLI commands registered',
    answers: [`${F}src/codekg/cli.ts`, `${A}Entry Points`],
  },
  {
    question: 'how are wiki links between sections validated',
    answers: [`${F}src/cli/check.ts`, 'lat.md/tests/check-md#Check Md Tests'],
  },
  {
    question: 'what is the materialization manifest',
    answers: [
      `${C}Merge-Safe Materialization`,
      `${F}src/codekg/types.ts`,
      `${F}src/codekg/bootstrap.ts`,
    ],
  },
  {
    question: 'how does a hook read its payload from stdin',
    answers: [`${C}Agent Guidance and Hooks`, `${F}tests/hook-stdin.test.ts`],
  },
];

/**
 * Questions about features the knowledge base was not written against, each
 * answered by a source file. Do not pick what to document or how to rank
 * from these: they only measure whether a change generalises.
 */
type FileQuestion = { question: string; files: string[] };

const HELD_OUT: FileQuestion[] = [
  {
    question:
      'where is the manifest written atomically so a crash cannot leave a partial file',
    files: ['src/codekg/cache.ts'],
  },
  {
    question: 'what happens when the lat config file contains invalid JSON',
    files: ['src/config.ts'],
  },
  {
    question: 'how are suppression tombstones stored and listed',
    files: ['src/codekg/suppress.ts'],
  },
  {
    question: 'how are generated section summaries rewritten with an LLM',
    files: ['src/codekg/enrich.ts'],
  },
  {
    question: 'how can I search across several repositories at once',
    files: ['src/codekg/workspace.ts'],
  },
  {
    question: 'how are wiki links extracted from markdown sections',
    files: ['src/lattice.ts', 'src/extensions/wiki-link/from-markdown.ts'],
  },
  {
    question: 'how does reconcile change the status of generated sections',
    files: ['src/codekg/reconcile.ts'],
  },
  {
    question: 'which file registers the MCP tools',
    files: ['src/codekg/mcp.ts'],
  },
  {
    question: 'which files does apply-backlinks refuse to edit',
    files: ['src/codekg/backlinks.ts'],
  },
  {
    question: 'how do I see a file API without reading the whole file',
    files: ['src/codekg/query.ts'],
  },
  {
    question:
      'where is the python encoding line handled when inserting a comment',
    files: ['src/codekg/backlinks.ts'],
  },
  {
    question: 'what does code-kg changed report for working tree edits',
    files: ['src/codekg/changed.ts'],
  },
  {
    question: 'how are undocumented and untested files reported',
    files: ['src/codekg/gaps.ts'],
  },
  {
    question: 'how are markdown headings parsed into sections',
    files: ['src/lattice.ts'],
  },
  {
    question: 'where does the embedding key come from',
    files: ['src/config.ts'],
  },
];

/**
 * Names an agent pastes from code, each answered by the file defining it.
 * Embeddings know little about these, so their semantic matches are mostly
 * noise that must not push the lexical answer down.
 */
const IDENTIFIERS: FileQuestion[] = [
  { question: 'detectProvider', files: ['src/search/provider.ts'] },
  { question: 'scanCodeRefs', files: ['src/code-refs.ts'] },
  { question: 'readSectionBodies', files: ['src/codekg/search.ts'] },
  { question: 'rankSectionsLexically', files: ['src/codekg/search.ts'] },
  { question: 'testDeclarations', files: ['src/codekg/cards.ts'] },
  { question: 'clampLeadingParagraph', files: ['src/codekg/limits.ts'] },
  { question: 'manifestOwner', files: ['src/codekg/anchors.ts'] },
  { question: 'anchorChanges', files: ['src/codekg/anchors.ts'] },
  { question: 'withinScope', files: ['src/codekg/query.ts'] },
  { question: 'graphRank', files: ['src/codekg/query.ts'] },
];

/**
 * Measured on the committed knowledge base. Raise these when ranking or
 * curated sections improve; lowering one needs a reason in the commit.
 */
const LEXICAL_FLOOR = { recallAt5: 0.824, mrr: 0.722 };
const SEMANTIC_FLOOR = { recallAt5: 0.941, mrr: 0.729 };
const HELD_OUT_LEXICAL_FLOOR = { recallAt5: 0.6, mrr: 0.45 };
const HELD_OUT_SEMANTIC_FLOOR = { recallAt5: 0.733, mrr: 0.63 };
const HELD_OUT_ASK_FLOOR = { recallAt5: 0.733, mrr: 0.578 };
const HELD_OUT_SEMANTIC_ASK_FLOOR = { recallAt5: 0.8, mrr: 0.649 };
const IDENTIFIER_ASK_FLOOR = { recallAt5: 1, mrr: 1 };
const IDENTIFIER_SEMANTIC_ASK_FLOOR = { recallAt5: 1, mrr: 0.683 };
/**
 * Generated per-file sections are top-N lists that reshuffle as the code
 * changes, so a run may fall this far below a floor. One question leaving
 * the top 5 costs 1/17, more than this.
 */
const SLACK = 0.03;

type Score = { recallAt5: number; mrr: number; report: string };

/** `ranks[i]` is the 1-based rank of the first hit for `questions[i]`, or 0. */
function score(ranks: number[], questions: string[]): Score {
  let hits = 0;
  let reciprocal = 0;
  const lines = ranks.map((rank, index) => {
    if (rank >= 1 && rank <= 5) hits++;
    if (rank >= 1) reciprocal += 1 / rank;
    return `${rank ? `#${rank}` : 'miss'}\t${questions[index]}`;
  });
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    recallAt5: round(hits / ranks.length),
    mrr: round(reciprocal / ranks.length),
    report: lines.join('\n'),
  };
}

function inSampleScore(rankings: string[][]): Score {
  return score(
    QUESTIONS.map(
      ({ answers }, index) =>
        rankings[index].findIndex((id) => answers.includes(id)) + 1,
    ),
    QUESTIONS.map(({ question }) => question),
  );
}

/** `rankings[i]` lists, per result, the files that result is about. */
function fileScore(
  set: readonly FileQuestion[],
  rankings: string[][][],
): Score {
  return score(
    set.map(
      ({ files }, index) =>
        rankings[index].findIndex((about) =>
          about.some((file) => files.includes(file)),
        ) + 1,
    ),
    set.map(({ question }) => question),
  );
}

function expectFloor(
  result: Score,
  floor: { recallAt5: number; mrr: number },
  label: string,
): void {
  console.info(
    `${label} recall@5=${result.recallAt5} mrr=${result.mrr}\n${result.report}`,
  );
  expect(result.recallAt5, result.report).toBeGreaterThanOrEqual(
    floor.recallAt5 - SLACK,
  );
  expect(result.mrr, result.report).toBeGreaterThanOrEqual(floor.mrr - SLACK);
}

const repoRoot = join(import.meta.dirname, '..');
const repoLatDir = join(repoRoot, 'lat.md');
let sections: Section[];
let bodies: Map<string, string>;
let anchoredFiles: Map<string, string[]>;

/** A section is about the file it is headed by, and the files it is anchored to. */
function sectionFiles(id: string, heading: string): string[] {
  return [heading, ...(anchoredFiles.get(id) ?? [])];
}

function hitFiles(hit: QueryHit): string[] {
  return hit.kind === 'source' ? [hit.path] : sectionFiles(hit.id, hit.title);
}

async function askScore(
  set: readonly FileQuestion[],
  semantic: boolean,
): Promise<Score> {
  const rankings: string[][][] = [];
  for (const { question } of set) {
    const result = await ask(repoRoot, question, {
      limit: 10,
      semantic,
      source: false,
    });
    if (semantic) expect(result.backend).toContain('semantic');
    rankings.push(result.hits.map(hitFiles));
  }
  return fileScore(set, rankings);
}

beforeAll(async () => {
  sections = flattenSections(await loadAllSections(repoLatDir));
  bodies = await readSectionBodies(repoLatDir, sections);
  const manifest = JSON.parse(
    readFileSync(
      join(repoRoot, '.code-kg', 'materialization-manifest.json'),
      'utf-8',
    ),
  ) as MaterializationManifest;
  anchoredFiles = new Map(
    Object.values(manifest.sections).map((entry) => [
      entry.public_section_id,
      (entry.source_anchors ?? []).map((anchor) => anchor.file),
    ]),
  );
});

describe('retrieval eval (lexical)', () => {
  it('names curated sections that exist, and an existing answer for every question', () => {
    const ids = new Set(sections.map((section) => section.id));
    const missingCurated = QUESTIONS.flatMap(({ answers }) => answers).filter(
      (id) => id.startsWith(C) && !ids.has(id),
    );
    const unanswerable = QUESTIONS.filter(
      ({ answers }) => !answers.some((id) => ids.has(id)),
    ).map(({ question }) => question);
    expect(missingCurated).toStrictEqual([]);
    expect(unanswerable).toStrictEqual([]);
  });

  it('stays at or above the recorded floor', () => {
    const result = inSampleScore(
      QUESTIONS.map(({ question }) =>
        rankSectionsLexically(sections, question, 10, bodies).map(
          (section) => section.id,
        ),
      ),
    );
    expectFloor(result, LEXICAL_FLOOR, 'lexical');
  });

  it('stays at or above the recorded floor on held-out questions', () => {
    const result = fileScore(
      HELD_OUT,
      HELD_OUT.map(({ question }) =>
        rankSectionsLexically(sections, question, 10, bodies).map((section) =>
          sectionFiles(section.id, section.heading),
        ),
      ),
    );
    expectFloor(result, HELD_OUT_LEXICAL_FLOOR, 'held-out lexical');
  });

  it('keeps ask without semantic search at or above the held-out floor', async () => {
    expectFloor(
      await askScore(HELD_OUT, false),
      HELD_OUT_ASK_FLOOR,
      'held-out ask',
    );
  }, 120_000);

  it('keeps ask without semantic search at or above the identifier floor', async () => {
    expectFloor(
      await askScore(IDENTIFIERS, false),
      IDENTIFIER_ASK_FLOOR,
      'identifier ask',
    );
  }, 120_000);
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

    async function semanticRankings(questions: string[]) {
      const provider = detectProvider('local');
      const rankings = [];
      for (const question of questions)
        rankings.push(
          await searchSections(db, question, provider, 'local', 10),
        );
      return rankings;
    }

    it('stays at or above the recorded floor', async () => {
      const rankings = await semanticRankings(
        QUESTIONS.map(({ question }) => question),
      );
      expectFloor(
        inSampleScore(rankings.map((results) => results.map((r) => r.id))),
        SEMANTIC_FLOOR,
        'semantic',
      );
    }, 300_000);

    it('stays at or above the recorded floor on held-out questions', async () => {
      const rankings = await semanticRankings(
        HELD_OUT.map(({ question }) => question),
      );
      expectFloor(
        fileScore(
          HELD_OUT,
          rankings.map((results) =>
            results.map((r) => sectionFiles(r.id, r.heading)),
          ),
        ),
        HELD_OUT_SEMANTIC_FLOOR,
        'held-out semantic',
      );
    }, 300_000);

    async function semanticAskScore(set: readonly FileQuestion[]) {
      const previous = process.env.LAT_EMBEDDING_PROVIDER;
      process.env.LAT_EMBEDDING_PROVIDER = 'local';
      try {
        return await askScore(set, true);
      } finally {
        if (previous === undefined) delete process.env.LAT_EMBEDDING_PROVIDER;
        else process.env.LAT_EMBEDDING_PROVIDER = previous;
      }
    }

    it('keeps ask with semantic search on held-out questions at or above its floor and ask without it', async () => {
      const lexical = await askScore(HELD_OUT, false);
      const semantic = await semanticAskScore(HELD_OUT);
      expectFloor(
        semantic,
        HELD_OUT_SEMANTIC_ASK_FLOOR,
        'held-out semantic ask',
      );
      expect(semantic.recallAt5).toBeGreaterThanOrEqual(
        lexical.recallAt5 - SLACK,
      );
      expect(semantic.mrr).toBeGreaterThanOrEqual(lexical.mrr - SLACK);
    }, 300_000);

    it('keeps ask with semantic search on identifiers at or above its floor', async () => {
      expectFloor(
        await semanticAskScore(IDENTIFIERS),
        IDENTIFIER_SEMANTIC_ASK_FLOOR,
        'identifier semantic ask',
      );
    }, 300_000);
  },
);
