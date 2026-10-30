// Compares the models available on the free tiers at each stage of retrieval, on the same
// questions as `npm run eval`, and writes the results to scripts/eval/models.md.
// Run with: npm run eval:models
//
// 1. Embedding models: semantic search alone, with Gemini (what the app uses) and two of
//    Pinecone's hosted models. Each Pinecone model's vectors go in their own namespace of the
//    same index, so the app's own vectors are never touched.
// 2. Rerankers: the full search pipeline, reranking the same top 20 hybrid candidates with
//    each of Pinecone's free rerankers.
//
// Costs: one Gemini embedding per question (Gemini's vectors for the notes are already
// stored), a few Pinecone embedding requests, and one rerank request per question for each
// reranker. Rerank results are cached in scripts/eval/.cache, so a rerun costs no reranks.
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { Pinecone } from '@pinecone-database/pinecone';
import { db } from '../../src/lib/db.js';
import { generateEmbedding, searchMemories } from '../../src/services/ai.js';
import { EMBEDDING_PAUSE_MS, loadMemories, sleep, withRetry } from '../lib/load-memories.js';
import { cacheReranking } from '../lib/rerank-cache.js';
import { memories, questions, type EvalQuestion } from './dataset.js';

process.env.LOG_SEARCH = 'false';
await cacheReranking();

const EVAL_EMAIL = 'eval@memory-assistant.local';
const TOP_K = 5;
const CANDIDATES = 20;
const PINECONE_EMBEDDERS = ['llama-text-embed-v2', 'multilingual-e5-large'];
const RERANKERS = ['bge-reranker-v2-m3', 'pinecone-rerank-v0'];
// Includes very low cutoffs, since each reranker scores on its own scale, and 0 (no cutoff),
// which shows how well each one orders the candidates
const RERANK_CUTOFFS = [0, 0.001, 0.005, 0.01, 0.05, 0.1, 0.2, 0.3, 0.5];

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index({ name: process.env.PINECONE_INDEX_NAME! });

const user = await db.user.upsert({
  where: { email: EVAL_EMAIL },
  update: {},
  create: { email: EVAL_EMAIL, name: 'Evaluation', passwordHash: '!' },
});
const keyById = await loadMemories(user.id, memories);
const saved = await db.memory.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });

// Every question's candidates, best first, with the score that model gave them
interface Ranked {
  question: EvalQuestion;
  matches: { key: string; score: number; strong: boolean }[];
}

const toMatches = (found: { id?: string | number; score?: number }[]) =>
  found.map((m) => ({ key: keyById.get(Number(m.id)) ?? '?', score: m.score ?? 0, strong: false }));

// --- 1. Embedding models ---

async function rankWithGemini(): Promise<Ranked[]> {
  const ranked: Ranked[] = [];
  for (const question of questions) {
    const vector = await withRetry(
      () => generateEmbedding(question.question, 'RETRIEVAL_QUERY'),
      question.question
    );
    const { matches } = await index.query({
      vector,
      topK: CANDIDATES,
      filter: { userId: user.id.toString() },
    });
    ranked.push({ question, matches: toMatches(matches) });
    await sleep(EMBEDDING_PAUSE_MS);
  }
  return ranked;
}

async function embedWithPinecone(model: string, inputs: string[], inputType: string) {
  const result = await withRetry(
    () =>
      pinecone.inference.embed({
        model,
        inputs,
        // Text past the model's input limit is cut from the end
        parameters: { inputType, truncate: 'END' },
      }),
    `${model} embeddings`
  );
  return result.data.map((e) => ('values' in e ? e.values : []));
}

async function rankWithPinecone(model: string): Promise<Ranked[]> {
  const namespace = index.namespace(`eval-${model}`);

  // Re-embed the notes unless this namespace already holds exactly the current ones
  const ids = saved.map((m) => m.id.toString());
  const { records } = await namespace.fetch({ ids });
  const stats = await index.describeIndexStats();
  const stored = stats.namespaces?.[`eval-${model}`]?.recordCount ?? 0;
  if (Object.keys(records).length !== ids.length || stored !== ids.length) {
    console.log(`  Embedding ${saved.length} notes with ${model}...`);
    if (stored > 0) await namespace.deleteAll();
    const vectors = await embedWithPinecone(
      model,
      saved.map((m) => (m.title ? `${m.title}\n${m.content}` : m.content)),
      'passage'
    );
    await namespace.upsert({
      records: saved.map((m, i) => ({ id: m.id.toString(), values: vectors[i] })),
    });
    // Pinecone makes new vectors searchable after a short delay
    for (let waited = 0; ; waited += 2) {
      const count = (await index.describeIndexStats()).namespaces?.[`eval-${model}`]?.recordCount;
      if (count === ids.length) break;
      if (waited >= 60) throw new Error(`Timed out waiting for ${model} vectors to be indexed`);
      await sleep(2000);
    }
    await sleep(5000);
  }

  const queryVectors = await embedWithPinecone(
    model,
    questions.map((q) => q.question),
    'query'
  );
  const ranked: Ranked[] = [];
  for (const [i, question] of questions.entries()) {
    const { matches } = await namespace.query({ vector: queryVectors[i], topK: CANDIDATES });
    ranked.push({ question, matches: toMatches(matches) });
  }
  return ranked;
}

// --- 2. Rerankers ---

async function rankWithReranker(model: string): Promise<Ranked[]> {
  process.env.RERANK_MODEL = model;
  process.env.MIN_RERANK_SCORE = '0';
  const ranked: Ranked[] = [];
  for (const question of questions) {
    const found = await withRetry(
      () =>
        searchMemories(question.question, user.id, {
          topK: CANDIDATES,
          mode: 'rerank',
          fallbackOnRerankError: false,
        }),
      question.question
    );
    ranked.push({
      question,
      matches: found.map((m) => ({
        key: keyById.get(m.id) ?? '?',
        score: m.rerankScore ?? 0,
        strong: m.strongMatch,
      })),
    });
    // Pinecone's free plan allows 60 rerank requests a minute
    await sleep(1000);
  }
  return ranked;
}

// --- 3. Scoring ---

const answerable = (r: Ranked) => r.question.expected.length > 0;
const topKeys = (r: Ranked, cutoff: number) =>
  r.matches
    .filter((m) => m.score >= cutoff || m.strong)
    .slice(0, TOP_K)
    .map((m) => m.key);

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
const percent = (value: number) => `${Math.round(value * 100)}%`;

function score(ranked: Ranked[], cutoff: number) {
  const withAnswer = ranked.filter(answerable);
  const without = ranked.filter((r) => !answerable(r));
  const closeCalls = ranked.filter((r) => r.question.kind === 'close-call');
  const rankOf = (r: Ranked) => {
    const position = topKeys(r, cutoff).findIndex((k) => r.question.expected.includes(k));
    return position === -1 ? null : position + 1;
  };
  return {
    hit1: average(withAnswer.map((r) => (rankOf(r) === 1 ? 1 : 0))),
    mrr: average(withAnswer.map((r) => (rankOf(r) === null ? 0 : 1 / rankOf(r)!))),
    recall: average(
      withAnswer.map(
        (r) =>
          r.question.expected.filter((k) => topKeys(r, cutoff).includes(k)).length /
          r.question.expected.length
      )
    ),
    noAnswer: average(without.map((r) => (topKeys(r, cutoff).length === 0 ? 1 : 0))),
    closeCall: average(closeCalls.map((r) => (topKeys(r, cutoff).length === 0 ? 1 : 0))),
  };
}

// Each embedding model scores on its own scale, so one similarity cutoff can't be used for
// all of them. This finds the highest cutoff that still keeps every right answer the model
// found, then reports how many unanswerable questions that cutoff rejects: how well the
// model's scores separate answers from non-answers, at its best possible cutoff.
function bestSeparation(ranked: Ranked[]) {
  const full = score(ranked, 0).recall;
  const candidates = [...new Set(ranked.flatMap((r) => r.matches.map((m) => m.score)))].sort(
    (a, b) => b - a
  );
  const cutoff = candidates.find((c) => score(ranked, c).recall >= full) ?? 0;
  return { cutoff, ...score(ranked, cutoff) };
}

// --- 4. Run and report ---

const embeddingRows: string[] = [];
const embedders: [string, () => Promise<Ranked[]>][] = [
  ['gemini-embedding-001 (used by the app)', rankWithGemini],
  ...PINECONE_EMBEDDERS.map((m): [string, () => Promise<Ranked[]>] => [m, () => rankWithPinecone(m)]),
];
for (const [name, rank] of embedders) {
  console.log(`Embedding model: ${name}`);
  const ranked = await rank();
  const all = score(ranked, 0);
  const best = bestSeparation(ranked);
  embeddingRows.push(
    `| ${name} | ${percent(all.hit1)} | ${all.mrr.toFixed(2)} | ${percent(all.recall)} | ` +
      `${best.cutoff.toFixed(3)} | ${percent(best.noAnswer)} | ${percent(best.closeCall)} |`
  );
}

const rerankRows: string[] = [];
for (const model of RERANKERS) {
  console.log(`Reranker: ${model}`);
  const ranked = await rankWithReranker(model);
  for (const cutoff of RERANK_CUTOFFS) {
    const s = score(ranked, cutoff);
    rerankRows.push(
      `| ${model} | ${cutoff} | ${percent(s.hit1)} | ${percent(s.recall)} | ` +
        `${percent(s.noAnswer)} | ${percent(s.closeCall)} |`
    );
  }
}

const lines = [
  '# Model comparison',
  '',
  `Run on ${new Date().toISOString().slice(0, 10)} with the ${memories.length} memories and ` +
    `${questions.length} questions of \`npm run eval\`. Generated by \`npm run eval:models\`.`,
  '',
  '## Embedding models (semantic search alone)',
  '',
  '*Hit@1, MRR and Recall@5 use no cutoff. Best cutoff: the highest similarity cutoff that ' +
    'still keeps every right answer the model found; the no-answer and close-call columns ' +
    'show how many questions without an answer that cutoff rejects. It is chosen with the ' +
    'answers known, so it is a best case for every model.*',
  '',
  '| Model | Hit@1 | MRR | Recall@5 | Best cutoff | No-answer at that cutoff | Close-call at that cutoff |',
  '|---|---|---|---|---|---|---|',
  ...embeddingRows,
  '',
  '## Rerankers (full pipeline: hybrid search, then reranking the top 20)',
  '',
  '| Reranker | Cutoff | Hit@1 | Recall@5 | No-answer | Close-call |',
  '|---|---|---|---|---|---|',
  ...rerankRows,
];

const report = lines.join('\n') + '\n';
await writeFile(new URL('./models.md', import.meta.url), report);
console.log(`\n${report}`);
console.log('Saved to scripts/eval/models.md');

await db.$disconnect();
process.exit(0);
