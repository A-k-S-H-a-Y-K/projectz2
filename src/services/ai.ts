import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenAI } from '@google/genai';
import type { Memory } from '@prisma/client';
import { db } from '../lib/db.js';

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
): Promise<Memory[]> {
  const queryEmbedding = await generateEmbedding(query, 'RETRIEVAL_QUERY');

  const searchResults = await index.query({
    vector: queryEmbedding,
    topK,
    filter: { userId: userId.toString() },
  });

  // Load the real records so results have correct dates, reflect later edits,
  // and can never include another user's memories
  const ids = searchResults.matches.map((match) => Number(match.id));
  const memories = await db.memory.findMany({
    where: { id: { in: ids }, userId },
  });

  // Keep Pinecone's relevance order
  const byId = new Map(memories.map((memory) => [memory.id, memory]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export async function generateAnswer(query: string, memories: Memory[]): Promise<string> {
  const context = memories
    .map(
      (m) =>
        `Title: ${m.title || 'Untitled'}\nContent: ${m.content}\nTags: ${m.tags.join(', ')}`
    )
    .join('\n\n');

  const prompt = `You are an AI assistant helping to answer questions based on the user's memories.
Context from user's memories:
${context}

User's question: ${query}

Please provide a helpful answer based on the context above. If the context doesn't contain relevant information, say so.`;

  const response = await gemini.models.generateContent({
    model: CHAT_MODEL,
    contents: prompt,
  });

  return response.text ?? '';
}
