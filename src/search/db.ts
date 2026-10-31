import { createClient, type Client } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function openDb(latDir: string): Client {
  const cacheDir = join(latDir, '.cache');
  mkdirSync(cacheDir, { recursive: true });

  const client = createClient({
    url: `file:${join(cacheDir, 'vectors.db')}`,
  });

  return client;
}

const MODEL_META_KEY = 'embedding_model';

/** The model the index was built with, as passed to ensureSchema. */
export async function indexedModel(db: Client): Promise<string | undefined> {
  const table = await db.execute(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'",
  );
  if (!table.rows.length) return undefined;
  const row = await db.execute({
    sql: 'SELECT value FROM meta WHERE key = ?',
    args: [MODEL_META_KEY],
  });
  return row.rows[0]?.value as string | undefined;
}

/**
 * Creates the vector tables, first dropping ones built with other dimensions
 * or another `model`. An index that predates model tracking is kept and
 * recorded as built with `model`.
 */
export async function ensureSchema(
  db: Client,
  dimensions: number,
  model?: string,
): Promise<void> {
  const current = await db.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'sections'",
  });
  const tableSql = current.rows[0]?.sql;
  if (typeof tableSql === 'string') {
    const match = /embedding\s+F32_BLOB\((\d+)\)/i.exec(tableSql);
    const currentDimensions = match ? parseInt(match[1], 10) : undefined;
    const recordedModel = model && (await indexedModel(db));
    if (
      (currentDimensions !== undefined && currentDimensions !== dimensions) ||
      (recordedModel && recordedModel !== model)
    ) {
      await db.execute('DROP INDEX IF EXISTS sections_vec_idx');
      await db.execute('DROP TABLE IF EXISTS sections');
      await db.execute('DROP TABLE IF EXISTS meta');
    }
  }

  await db.execute(
    `CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      file TEXT NOT NULL,
      heading TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      embedding F32_BLOB(${dimensions}),
      updated_at INTEGER NOT NULL
    )`,
  );

  await db.execute(
    `CREATE INDEX IF NOT EXISTS sections_vec_idx
     ON sections (libsql_vector_idx(embedding))`,
  );

  await db.execute(
    `CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  );

  if (model)
    await db.execute({
      sql: 'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
      args: [MODEL_META_KEY, model],
    });
}

export async function closeDb(db: Client): Promise<void> {
  db.close();
}
