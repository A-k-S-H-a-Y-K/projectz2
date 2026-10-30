// Replaces a user's memories with a fixed set and waits until they're searchable.
// Shared by the evaluation and demo seed scripts.
import { Pinecone } from '@pinecone-database/pinecone';
import { db } from '../../src/lib/db.js';
import { storeMemoryEmbedding, deleteMemoryEmbedding } from '../../src/services/ai.js';
import type { EvalMemory } from '../eval/dataset.js';

// Spaces out embedding calls to stay under the Gemini free tier's per-minute limit
export const EMBEDDING_PAUSE_MS = 700;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries calls that hit a rate limit, waiting for the per-minute quota to reset, and calls
// to a briefly overloaded model (503), waiting longer each time
export async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // A daily limit won't reset in 30 seconds, so there's no point waiting
      if (/PerDay/i.test(String(error))) {
        throw new Error(
          `${label}: the free tier's daily quota is used up. Try again after it resets ` +
            '(the error below says when).',
          { cause: error }
        );
      }
      const overloaded = /\b503\b|UNAVAILABLE|overloaded|high demand/i.test(String(error));
      if (overloaded && attempt <= 4) {
        const seconds = 10 * 2 ** (attempt - 1);
        console.log(`  ${label}: model busy, waiting ${seconds}s (retry ${attempt}/4)`);
        await sleep(seconds * 1000);
        continue;
      }
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
  for (const { key, savedAt, title, content, tags } of memories) {
    const memory = await db.memory.create({
      data: { title, content, tags, userId, createdAt: new Date(savedAt) },
    });
    keyById.set(memory.id, key);
    await withRetry(() => storeMemoryEmbedding(memory), key);
    await sleep(EMBEDDING_PAUSE_MS);
  }

  // Pinecone makes new vectors searchable after a short delay
  console.log('Waiting for Pinecone to index them...');
  const ids = [...keyById.keys()];
  for (let waited = 0; (await countIndexed(ids)) < ids.length; waited += 2) {
    if (waited >= 60) throw new Error('Timed out waiting for Pinecone to index the memories');
    await sleep(2000);
  }
  await sleep(5000);

  return keyById;
}

// How many of these memories have a vector in Pinecone
async function countIndexed(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const index = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! }).index({
    name: process.env.PINECONE_INDEX_NAME!,
  });
  const { records } = await index.fetch({ ids: ids.map(String) });
  return Object.keys(records).length;
}

// Same as replaceMemories, but keeps the user's memories if they already match the dataset
// exactly and are all in Pinecone. Saves one embedding request per memory, which matters on
// the free tier's 1,000 a day.
export async function loadMemories(
  userId: number,
  memories: EvalMemory[]
): Promise<Map<number, string>> {
  const signature = (m: { title: string | null; content: string; tags: string[]; date: string }) =>
    JSON.stringify([m.title, m.content, m.tags, m.date]);
  const keyBySignature = new Map(
    memories.map((m) => [
      signature({ ...m, date: new Date(m.savedAt).toISOString() }),
      m.key,
    ])
  );

  const existing = await db.memory.findMany({ where: { userId } });
  const keyById = new Map<number, string>();
  for (const m of existing) {
    const key = keyBySignature.get(signature({ ...m, date: m.createdAt.toISOString() }));
    if (key) keyById.set(m.id, key);
  }

  const unchanged =
    existing.length === memories.length &&
    new Set(keyById.values()).size === memories.length &&
    (await countIndexed([...keyById.keys()])) === memories.length;
  if (unchanged) {
    console.log(`Reusing the ${memories.length} memories already loaded.`);
    return keyById;
  }
  return replaceMemories(userId, memories);
}
