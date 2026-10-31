import type { Client } from '@libsql/client';
import { embed } from './embeddings.js';
import type { EmbeddingProvider } from './provider.js';

export type SearchResult = {
  id: string;
  file: string;
  heading: string;
  content: string;
  /** Cosine similarity between the query and the section, at most 1. */
  score: number;
};

/** Questions no codebase answers; see noiseFloor. */
const OFF_TOPIC_PROBES = [
  'pizza recipes with fresh basil',
  'what is the weather in Paris tomorrow',
  'who won the football match last night',
  'best hiking trails in the mountains',
  'symptoms of the common cold',
  'how to train a puppy to sit',
  'history of the Roman empire',
  'cheap flights to Tokyo',
  'how to knit a wool scarf',
  'lyrics of a famous pop song',
  'how long to boil an egg',
  'tips for growing tomatoes in a garden',
];

export const NOISE_FLOOR_META_KEY = 'noise_floor';

async function nearest(
  db: Client,
  vector: number[],
  limit: number,
): Promise<SearchResult[]> {
  const vecJson = JSON.stringify(vector);
  const rows = await db.execute({
    sql: `SELECT s.id, s.file, s.heading, s.content,
                 vector_distance_cos(s.embedding, vector(?)) AS distance
          FROM vector_top_k('sections_vec_idx', vector(?), ?) AS v
          JOIN sections AS s ON s.rowid = v.id
          ORDER BY distance`,
    args: [vecJson, vecJson, limit],
  });
  return rows.rows.map((row) => ({
    id: row.id as string,
    file: row.file as string,
    heading: row.heading as string,
    content: row.content as string,
    score: 1 - (row.distance as number),
  }));
}

export async function searchSections(
  db: Client,
  query: string,
  provider: EmbeddingProvider,
  key: string,
  limit = 5,
): Promise<SearchResult[]> {
  const [queryVec] = await embed([query], provider, key, 'query');
  return nearest(db, queryVec, limit);
}

/**
 * The highest similarity an off-topic probe question reaches in this index.
 * Similarity scales differ by model (bge-small puts unrelated text near 0.5),
 * so a match no closer than this says nothing about the query. Cached in
 * `meta` until indexSections changes the indexed sections.
 */
// @lat: [[lat.md/concepts#Concepts#Search Backends]]
export async function noiseFloor(
  db: Client,
  provider: EmbeddingProvider,
  key: string,
): Promise<number> {
  const cached = await db.execute({
    sql: 'SELECT value FROM meta WHERE key = ?',
    args: [NOISE_FLOOR_META_KEY],
  });
  if (cached.rows.length) return Number(cached.rows[0].value);
  let floor = -1;
  for (const vector of await embed(OFF_TOPIC_PROBES, provider, key, 'query'))
    for (const match of await nearest(db, vector, 1))
      floor = Math.max(floor, match.score);
  await db.execute({
    sql: 'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    args: [NOISE_FLOOR_META_KEY, String(floor)],
  });
  return floor;
}
