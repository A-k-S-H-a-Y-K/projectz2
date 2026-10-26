// Replaces a user's memories with a fixed set and waits until they're searchable.
// Shared by the evaluation and demo seed scripts.
import { Pinecone } from '@pinecone-database/pinecone';
import { db } from '../../src/lib/db.js';
import { storeMemoryEmbedding, deleteMemoryEmbedding } from '../../src/services/ai.js';
import type { EvalMemory } from '../eval/dataset.js';

// Spaces out embedding calls to stay under the Gemini free tier's per-minute limit
export const EMBEDDING_PAUSE_MS = 700;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries calls that hit a rate limit, waiting for the per-minute quota to reset
export async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const rateLimited = /429|RESOURCE_EXHAUSTED|quota/i.test(String(error));
      if (!rateLimited || attempt > 3) throw error;
      console.log(`  ${label}: rate limited, waiting 30s (retry ${attempt}/3)`);
      await sleep(30_000);
    }
  }
}

// Returns a map from new memory id to dataset key
export async function replaceMemories(
  userId: number,
  memories: EvalMemory[]
): Promise<Map<number, string>> {
  const old = await db.memory.findMany({ where: { userId }, select: { id: true } });
  if (old.length > 0) {
    console.log(`Removing ${old.length} existing memories...`);
    await Promise.all(old.map(({ id }) => deleteMemoryEmbedding(id)));
    await db.memory.deleteMany({ where: { userId } });
  }

  console.log(`Loading ${memories.length} memories...`);
  const keyById = new Map<number, string>();
  for (const { key, title, content, tags } of memories) {
    const memory = await db.memory.create({ data: { title, content, tags, userId } });
    keyById.set(memory.id, key);
    await withRetry(() => storeMemoryEmbedding(memory), key);
    await sleep(EMBEDDING_PAUSE_MS);
  }

  // Pinecone makes new vectors searchable after a short delay
  console.log('Waiting for Pinecone to index them...');
  const index = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! }).index({
    name: process.env.PINECONE_INDEX_NAME!,
  });
  const ids = [...keyById.keys()].map(String);
  for (let waited = 0; ; waited += 2) {
    const { records } = await index.fetch({ ids });
    if (Object.keys(records).length === ids.length) break;
    if (waited >= 60) throw new Error('Timed out waiting for Pinecone to index the memories');
    await sleep(2000);
  }
  await sleep(5000);

  return keyById;
}
