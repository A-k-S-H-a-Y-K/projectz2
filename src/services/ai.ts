import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenAI } from '@google/genai';
import type { Memory } from '@prisma/client';
import { db } from '../lib/db.js';
import type { ScoredMemory } from '../types/index.js';

if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
  throw new Error(
    'Missing Pinecone configuration: Please set PINECONE_API_KEY and PINECONE_INDEX_NAME in your .env file.'
  );
}
if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing Gemini configuration: Please set GEMINI_API_KEY in your .env file.');
}

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME;
const index = pinecone.index({ name: indexName });

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const EMBEDDING_MODEL = 'gemini-embedding-001';
// Must match the Pinecone index dimension (see scripts/setup-pinecone.ts)
const EMBEDDING_DIMENSION = 1024;
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-flash-lite-latest';

// Search matches below this cosine similarity are treated as unrelated.
// In testing, unrelated memories scored about 0.43-0.47 and relevant ones above 0.6.
const MIN_RELEVANCE_SCORE = Number(process.env.MIN_RELEVANCE_SCORE ?? 0.55);

// Gemini tunes embeddings differently for stored documents and search queries
type EmbeddingTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

// Check the index exists at startup so a typo shows up immediately in the logs
(async () => {
  try {
    const { indexes = [] } = await pinecone.listIndexes();
    const indexNames = indexes.map((i) => i.name);

    if (!indexNames.includes(indexName)) {
      throw new Error(
        `Pinecone index "${indexName}" not found. Available indexes: ${indexNames.join(', ')}`
      );
    }

    console.log(`Connected to Pinecone index: ${indexName}`);
  } catch (error) {
    console.error('Error connecting to Pinecone:', error);
  }
})();

export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTask,
  title?: string
): Promise<number[]> {
  const response = await gemini.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType,
      outputDimensionality: EMBEDDING_DIMENSION,
      ...(title && taskType === 'RETRIEVAL_DOCUMENT' && { title }),
    },
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!embedding) {
    throw new Error('Gemini returned no embedding');
  }
  return embedding;
}

export async function storeMemoryEmbedding(memory: Memory) {
  const embedding = await generateEmbedding(
    memory.content,
    'RETRIEVAL_DOCUMENT',
    memory.title ?? undefined
  );
  await index.upsert({
    records: [
      {
        id: memory.id.toString(),
        values: embedding,
        metadata: {
          userId: memory.userId.toString(),
          content: memory.content,
          title: memory.title || '',
          tags: memory.tags,
        },
      },
    ],
  });
  console.log(`Memory stored in Pinecone (ID: ${memory.id})`);
}

export async function deleteMemoryEmbedding(memoryId: number) {
  await index.deleteOne({ id: memoryId.toString() });
}

export async function searchMemories(
  query: string,
  userId: number,
  topK: number = 5
): Promise<ScoredMemory[]> {
  const queryEmbedding = await generateEmbedding(query, 'RETRIEVAL_QUERY');

  const searchResults = await index.query({
    vector: queryEmbedding,
    topK,
    filter: { userId: userId.toString() },
  });

  // Logged so the relevance cutoff can be tuned from real queries
  console.log(
    `Search scores: ${searchResults.matches
      .map((match) => `#${match.id}=${(match.score ?? 0).toFixed(3)}`)
      .join(', ') || 'no matches'}`
  );

  const scores = new Map(
    searchResults.matches
      .filter((match) => (match.score ?? 0) >= MIN_RELEVANCE_SCORE)
      .map((match) => [Number(match.id), match.score ?? 0])
  );

  // Load the real records so results have correct dates, reflect later edits,
  // and can never include another user's memories
  const memories = await db.memory.findMany({
    where: { id: { in: [...scores.keys()] }, userId },
  });

  // Most relevant first
  return memories
    .map((memory) => ({ ...memory, score: scores.get(memory.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

// Memories are numbered from 1 in the order given, so the answer can cite them as [n]
export async function generateAnswer(query: string, memories: Memory[]): Promise<string> {
  const context = memories
    .map(
      (m, i) =>
        `[${i + 1}] Title: ${m.title || 'Untitled'}
Date: ${m.createdAt.toISOString().slice(0, 10)}
Tags: ${m.tags.join(', ') || 'none'}
Content: ${m.content}`
    )
    .join('\n\n');

  const prompt = `You answer questions using only the user's saved memories below.
Each memory is numbered. After each fact you use, cite the memory it came from in square brackets, like [1] or [1][2].
If the memories don't contain the answer, say you couldn't find it in their memories and don't cite anything.

Memories:
${context}

Question: ${query}`;

  const response = await gemini.models.generateContent({
    model: CHAT_MODEL,
    contents: prompt,
  });

  return response.text ?? '';
}

// Returns the memory numbers cited in an answer, e.g. "... [1][3]" -> {1, 3}
export function extractCitations(answer: string): Set<number> {
  return new Set([...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])));
}
