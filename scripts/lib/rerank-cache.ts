// Saves rerank results to a file, so evaluation scripts never send the same rerank request
// twice. Pinecone's free plan allows only 500 rerank requests a month per model, and the
// live app needs most of them. Same model, question and documents give the same scores.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { reranker } from '../../src/services/ai.js';

const CACHE_DIR = new URL('../eval/.cache/', import.meta.url);
const CACHE_FILE = new URL('rerank.json', CACHE_DIR);

type RerankResult = Awaited<ReturnType<typeof reranker.rerank>>;

export async function cacheReranking(): Promise<void> {
  let cache: Record<string, RerankResult> = {};
  try {
    cache = JSON.parse(await readFile(CACHE_FILE, 'utf8'));
  } catch {
    // No cache yet
  }

  const send = reranker.rerank;
  let saved = 0;
  reranker.rerank = async (options) => {
    const key = createHash('sha256').update(JSON.stringify(options)).digest('hex');
    if (cache[key]) return cache[key];

    const result = await send(options);
    cache[key] = result;
    saved += 1;
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(cache));
    return result;
  };

  process.on('exit', () => {
    console.log(`Rerank requests sent to Pinecone in this run: ${saved}`);
  });
}
