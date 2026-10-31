import { describe, expect, it, vi } from 'vitest';
import { embed } from '../src/search/embeddings.js';
import type { LocalEmbeddingProvider } from '../src/search/provider.js';

const seen: string[][] = [];

vi.mock('@huggingface/transformers', () => ({
  pipeline: async () => async (input: string[]) => {
    seen.push(input);
    return { tolist: () => input.map(() => [1, 0]) };
  },
}));

const local = (model: string): LocalEmbeddingProvider => ({
  kind: 'local',
  name: 'local',
  model,
  dimensions: 2,
});

describe('local embeddings', () => {
  it('prefix English bge queries with the retrieval instruction, and nothing else', async () => {
    seen.length = 0;
    await embed(
      ['how are edits kept'],
      local('Xenova/bge-small-en-v1.5'),
      'local',
      'query',
    );
    await embed(['## Section'], local('Xenova/bge-small-en-v1.5'), 'local');
    await embed(
      ['how are edits kept'],
      local('Xenova/all-MiniLM-L6-v2'),
      'local',
      'query',
    );

    expect(seen).toStrictEqual([
      [
        'Represent this sentence for searching relevant passages: how are edits kept',
      ],
      ['## Section'],
      ['how are edits kept'],
    ]);
  });
});
