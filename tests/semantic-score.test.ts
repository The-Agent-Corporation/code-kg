import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { semanticBonus } from '../src/codekg/query.js';
import { closeDb, ensureSchema, openDb } from '../src/search/db.js';
import { indexSections } from '../src/search/index.js';
import type { LocalEmbeddingProvider } from '../src/search/provider.js';
import { noiseFloor, searchSections } from '../src/search/search.js';

const batches: string[][] = [];

/** Texts mentioning alpha or beta point along their own axis; anything else is off-topic. */
function vector(text: string): number[] {
  const lower = text.toLowerCase();
  if (lower.includes('alpha')) return [1, 0, 0];
  if (lower.includes('beta')) return [0, 1, 0];
  return [0.6, 0, 0.8];
}

vi.mock('@huggingface/transformers', () => ({
  pipeline: async () => async (input: string[]) => {
    batches.push(input);
    return { tolist: () => input.map(vector) };
  },
}));

const provider: LocalEmbeddingProvider = {
  kind: 'local',
  name: 'local',
  model: 'test/three-axis',
  dimensions: 3,
};

describe('semantic scores', () => {
  it('returns cosine similarity and caches the noise floor until the sections change', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lat-semantic-score-'));
    const latDir = join(tmp, 'lat.md');
    mkdirSync(latDir);
    const notes = join(latDir, 'notes.md');
    writeFileSync(
      notes,
      '# Notes\n\nAlpha and beta.\n\n## Alpha\n\nalpha text.\n\n## Beta\n\nbeta text.\n',
    );
    const db = openDb(latDir);
    const probeBatches = () =>
      batches.filter((batch) => batch.includes('how to knit a wool scarf'))
        .length;
    try {
      await ensureSchema(db, provider.dimensions);
      await indexSections(latDir, db, provider, 'local');

      const results = await searchSections(
        db,
        'alpha question',
        provider,
        'local',
        5,
      );
      const score = (heading: string) =>
        results.find((result) => result.heading === heading)?.score;
      expect(score('Alpha')).toBeCloseTo(1);
      expect(score('Beta')).toBeCloseTo(0);
      expect(results[0].score).toBeGreaterThanOrEqual(
        results[results.length - 1].score,
      );

      expect(await noiseFloor(db, provider, 'local')).toBeCloseTo(0.6);
      expect(await noiseFloor(db, provider, 'local')).toBeCloseTo(0.6);
      expect(probeBatches()).toBe(1);

      writeFileSync(
        notes,
        '# Notes\n\nAlpha and beta.\n\n## Alpha\n\nalpha text.\n\n## Gamma\n\nunrelated text.\n',
      );
      await indexSections(latDir, db, provider, 'local');
      expect(await noiseFloor(db, provider, 'local')).toBeCloseTo(1);
      expect(probeBatches()).toBe(2);
    } finally {
      await closeDb(db);
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('semanticBonus', () => {
  const match = (id: string, score: number) => ({ section: { id }, score });

  it('gives the closest match 1 and falls linearly to 0 at the noise floor', () => {
    expect(
      semanticBonus(
        [match('a', 0.8), match('b', 0.7), match('c', 0.6), match('d', 0.5)],
        0.6,
      ),
    ).toStrictEqual(
      new Map([
        ['a', 1],
        ['b', expect.closeTo(0.5)],
      ]),
    );
  });

  it('gives nothing when no match is closer than the noise floor', () => {
    expect(semanticBonus([match('a', 0.55), match('b', 0.5)], 0.6).size).toBe(
      0,
    );
    expect(semanticBonus([], 0.6).size).toBe(0);
  });
});
