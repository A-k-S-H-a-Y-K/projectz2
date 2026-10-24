import { Pinecone } from '@pinecone-database/pinecone';
import MistralClient from '@mistralai/mistralai';
import type { Memory } from '@prisma/client';
import { db } from '../lib/db.js';

if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
  throw new Error(
    'Missing Pinecone configuration: Please set PINECONE_API_KEY and PINECONE_INDEX_NAME in your .env file.'
  );
}
if (!process.env.MISTRAL_API_KEY) {
  throw new Error('Missing Mistral configuration: Please set MISTRAL_API_KEY in your .env file.');
}

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME;
const index = pinecone.index(indexName);

const mistral = new MistralClient(process.env.MISTRAL_API_KEY);

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

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await mistral.embeddings({
    model: 'mistral-embed',
    input: text,
  });
  return response.data[0].embedding;
}

export async function storeMemoryEmbedding(memory: Memory) {
  const embedding = await generateEmbedding(memory.content);
  await index.upsert([
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
  ]);
  console.log(`Memory stored in Pinecone (ID: ${memory.id})`);
}

export async function deleteMemoryEmbedding(memoryId: number) {
  await index.deleteOne(memoryId.toString());
}

export async function searchMemories(
  query: string,
  userId: number,
  topK: number = 5
): Promise<Memory[]> {
  const queryEmbedding = await generateEmbedding(query);

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

  const response = await mistral.chat({
    model: 'mistral-medium',
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0].message.content;
}
