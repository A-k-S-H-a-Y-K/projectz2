// import { Pinecone } from '@pinecone-database/pinecone';
// import MistralClient from '@mistralai/mistralai';
// import type { Prisma } from '@prisma/client';


// type Memory = Prisma.MemoryGetPayload<{}>;

// if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT || !process.env.PINECONE_INDEX_NAME) {
//   throw new Error('Missing Pinecone configuration: Please set PINECONE_API_KEY, PINECONE_ENVIRONMENT, and PINECONE_INDEX_NAME in your .env file.');
// }

// const pinecone = new Pinecone({apiKey: process.env.PINECONE_API_KEY!, environment: process.env.PINECONE_ENVIRONMENT!});

// const mistral = new MistralClient(process.env.MISTRAL_API_KEY!);

// const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);

// export async function generateEmbedding(text: string): Promise<number[]> {
//   const response = await mistral.embeddings({
//     model: 'mistral-embed',
//     input: text,
//   });
//   return response.data[0].embedding;
// }

// export async function storeMemoryEmbedding(memory: Memory) {
//   const embedding = await generateEmbedding(memory.content);
//   await index.upsert([{
//     id: memory.id.toString(),
//     values: embedding,
//     metadata: {
//       userId: memory.userId.toString(),
//       content: memory.content,
//       title: memory.title || '',
//       tags: memory.tags,
//     },
//   }]);
// }

// export async function searchMemories(
//   query: string,
//   userId: string,
//   topK: number = 5
// ): Promise<Memory[]> {
//   const queryEmbedding = await generateEmbedding(query);
  
//   const searchResults = await index.query({
//     vector: queryEmbedding,
//     topK,
//     filter: { userId },
//     includeMetadata: true,
//   });

//   return searchResults.matches.map(match => ({
//     id: Number(match.id),
//     userId: Number(match.metadata?.userId),
//     content: match.metadata?.content as string,
//     title: match.metadata?.title as string || null,
//     tags: match.metadata?.tags as string[],
//     createdAt: new Date(), // Note: This is a placeholder as Pinecone doesn't store dates
//   }));
// }

// export async function generateAnswer(
//   query: string,
//   memories: Memory[]
// ): Promise<string> {
//   const context = memories
//     .map(m => `Title: ${m.title || 'Untitled'}\nContent: ${m.content}\nTags: ${m.tags.join(', ')}`)
//     .join('\n\n');

//   const prompt = `You are an AI assistant helping to answer questions based on the user's memories.
// Context from user's memories:
// ${context}

// User's question: ${query}

// Please provide a helpful answer based on the context above. If the context doesn't contain relevant information, say so.`;

//   const response = await mistral.chat({
//     model: 'mistral-medium',
//     messages: [{ role: 'user', content: prompt }],
//   });

//   return response.choices[0].message.content;
// } 



import { Pinecone } from '@pinecone-database/pinecone';
import MistralClient from '@mistralai/mistralai';
import type { Prisma } from '@prisma/client';

type Memory = Prisma.MemoryGetPayload<{}>;

// ✅ Validate required environment variables
if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
  throw new Error(
    'Missing Pinecone configuration: Please set PINECONE_API_KEY and PINECONE_INDEX_NAME in your .env file.'
  );
}
if (!process.env.MISTRAL_API_KEY) {
  throw new Error('Missing Mistral configuration: Please set MISTRAL_API_KEY in your .env file.');
}

// ✅ Initialize Pinecone client (no environment needed in new SDK)
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

// ✅ Initialize index object
const indexName = process.env.PINECONE_INDEX_NAME!;
const index = pinecone.index(indexName);

// ✅ Initialize Mistral client
const mistral = new MistralClient(process.env.MISTRAL_API_KEY!);

// ✅ Optional: Check Pinecone connectivity
(async () => {
  try {
    const listResponse = await pinecone.listIndexes();
    const indexNames = listResponse.indexes?.map(i => i.name) || [];

    if (!indexNames.includes(indexName)) {
      throw new Error(
        `Pinecone index "${indexName}" not found. Available indexes: ${indexNames.join(', ')}`
      );
    }

    console.log(`✅ Connected to Pinecone index: ${indexName}`);
  } catch (error) {
    console.error('❌ Error connecting to Pinecone:', error);
  }
})();



// ✅ Generate vector embedding using Mistral
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await mistral.embeddings({
    model: 'mistral-embed',
    input: text,
  });
  return response.data[0].embedding;
}

// ✅ Store memory in Pinecone
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
  console.log(`✅ Memory stored in Pinecone (ID: ${memory.id})`);
}

// ✅ Semantic search for user memories
export async function searchMemories(
  query: string,
  userId: string,
  topK: number = 5
): Promise<Memory[]> {
  const queryEmbedding = await generateEmbedding(query);

  const searchResults = await index.query({
    vector: queryEmbedding,
    topK,
    filter: { userId },
    includeMetadata: true,
  });

  return searchResults.matches.map((match) => ({
    id: Number(match.id),
    userId: Number(match.metadata?.userId),
    content: match.metadata?.content as string,
    title: match.metadata?.title as string || null,
    tags: match.metadata?.tags as string[],
    createdAt: new Date(), // Pinecone does not store this
  }));
}

// ✅ Use context to generate an answer with Mistral
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
