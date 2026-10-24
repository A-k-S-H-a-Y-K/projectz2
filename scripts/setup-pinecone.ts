// Creates the Pinecone index used to store memory embeddings.
// Run once with: npm run pinecone:setup
import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';

// Must match EMBEDDING_DIMENSION in src/services/ai.ts
const EMBEDDING_DIMENSION = 1024;

const apiKey = process.env.PINECONE_API_KEY;
const indexName = process.env.PINECONE_INDEX_NAME;

if (!apiKey || !indexName) {
  console.error('Set PINECONE_API_KEY and PINECONE_INDEX_NAME in your .env file first.');
  process.exit(1);
}

const pinecone = new Pinecone({ apiKey });

console.log(`Creating Pinecone index "${indexName}"...`);

await pinecone.indexes.create({
  name: indexName,
  // A schema with only the reserved `_values` field creates a plain vector index,
  // so the app supplies its own embeddings instead of using a Pinecone-hosted model
  schema: {
    fields: {
      _values: { type: 'dense_vector', dimension: EMBEDDING_DIMENSION, metric: 'cosine' },
    },
  },
  deployment: { deploymentType: 'managed', cloud: 'aws', region: 'us-east-1' },
  waitUntilReady: true,
  suppressConflicts: true,
});

const index = await pinecone.indexes.describe(indexName);
console.log(`Index "${index.name}" is ready.`);
