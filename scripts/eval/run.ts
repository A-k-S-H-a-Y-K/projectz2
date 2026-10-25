// Measures how well each search mode finds the right memories for the questions in
// dataset.ts, and writes the results to scripts/eval/results.md.
// Run with: npm run eval
//
// Uses a separate eval user, so your own memories are never touched. Only embedding calls
// are made (one per memory, plus one per question for each mode that uses semantic search);
// no answers are generated.
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { Pinecone } from '@pinecone-database/pinecone';
import { db } from '../../src/lib/db.js';
import {
  searchMemories,
  storeMemoryEmbedding,
  deleteMemoryEmbedding,
} from '../../src/services/ai.js';
import type { SearchMode } from '../../src/types/index.js';
import { memories, questions, type EvalQuestion } from './dataset.js';

process.env.LOG_SEARCH = 'false';

const EVAL_EMAIL = 'eval@memory-assistant.local';
const TOP_K = 5;
const MODES: SearchMode[] = ['semantic', 'keyword', 'hybrid'];
// Spaces out embedding calls to stay under the Gemini free tier's per-minute limit
const EMBEDDING_PAUSE_MS = 700;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries calls that hit a rate limit, waiting for the per-minute quota to reset
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
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

// --- 1. Load the dataset into a fresh eval user ---

const user = await db.user.upsert({
  where: { email: EVAL_EMAIL },
  update: {},
  // Not a real login: no password can match this hash
  create: { email: EVAL_EMAIL, name: 'Evaluation', passwordHash: '!' },
});

const oldMemories = await db.memory.findMany({ where: { userId: user.id }, select: { id: true } });
if (oldMemories.length > 0) {
  console.log(`Removing ${oldMemories.length} memories from the previous run...`);
  await Promise.all(oldMemories.map(({ id }) => deleteMemoryEmbedding(id)));
  await db.memory.deleteMany({ where: { userId: user.id } });
}

console.log(`Loading ${memories.length} memories...`);
const keyById = new Map<number, string>();
for (const { key, title, content, tags } of memories) {
  const memory = await db.memory.create({ data: { title, content, tags, userId: user.id } });
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

// --- 2. Run every question through every mode ---

interface QuestionResult {
  question: EvalQuestion;
  resultKeys: string[];
  ms: number;
}

const results = new Map<SearchMode, QuestionResult[]>();
for (const mode of MODES) {
  console.log(`Running ${questions.length} questions in ${mode} mode...`);
  const modeResults: QuestionResult[] = [];
  for (const question of questions) {
    const start = performance.now();
    const found = await withRetry(
      () => searchMemories(question.question, user.id, TOP_K, mode),
      question.question
    );
    const ms = performance.now() - start;
    modeResults.push({ question, resultKeys: found.map((m) => keyById.get(m.id) ?? '?'), ms });
    if (mode !== 'keyword') await sleep(EMBEDDING_PAUSE_MS);
  }
  results.set(mode, modeResults);
}

// --- 3. Score the results ---

// 1-based position of the first expected memory in the results, or null if none was found
const firstHitRank = ({ question, resultKeys }: QuestionResult) => {
  const position = resultKeys.findIndex((key) => question.expected.includes(key));
  return position === -1 ? null : position + 1;
};

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
const percent = (value: number) => `${(value * 100).toFixed(0)}%`;

function score(modeResults: QuestionResult[]) {
  const answerable = modeResults.filter((r) => r.question.expected.length > 0);
  const unanswerable = modeResults.filter((r) => r.question.expected.length === 0);
  const ranks = answerable.map(firstHitRank);

  return {
    hit1: average(ranks.map((rank) => (rank === 1 ? 1 : 0))),
    hit3: average(ranks.map((rank) => (rank !== null && rank <= 3 ? 1 : 0))),
    mrr: average(ranks.map((rank) => (rank === null ? 0 : 1 / rank))),
    // Share of all expected memories found in the results, which matters for multi-memory questions
    recall: average(
      answerable.map(
        (r) =>
          r.question.expected.filter((key) => r.resultKeys.includes(key)).length /
          r.question.expected.length
      )
    ),
    noAnswer: average(unanswerable.map((r) => (r.resultKeys.length === 0 ? 1 : 0))),
    ms: average(modeResults.map((r) => r.ms)),
  };
}

const answerableKinds = ['paraphrase', 'exact', 'multi'] as const;
const countOf = (kind: EvalQuestion['kind']) => questions.filter((q) => q.kind === kind).length;

const lines: string[] = [
  '# Retrieval evaluation',
  '',
  `Run on ${new Date().toISOString().slice(0, 10)} with ${memories.length} memories and ` +
    `${questions.length} questions (${answerableKinds.map((k) => `${countOf(k)} ${k}`).join(', ')}, ` +
    `${countOf('unanswerable')} unanswerable), top ${TOP_K} results. Generated by \`npm run eval\`.`,
  '',
  '| Mode | Hit@1 | Hit@3 | MRR | Recall@5 | No-answer accuracy | Avg search time |',
  '|---|---|---|---|---|---|---|',
];
for (const mode of MODES) {
  const s = score(results.get(mode)!);
  lines.push(
    `| ${mode} | ${percent(s.hit1)} | ${percent(s.hit3)} | ${s.mrr.toFixed(2)} | ` +
      `${percent(s.recall)} | ${percent(s.noAnswer)} | ${Math.round(s.ms)} ms |`
  );
}

lines.push('', '**Hit@1 by question type**', '', `| Mode | ${answerableKinds.join(' | ')} |`, '|---|---|---|---|');
for (const mode of MODES) {
  const byKind = answerableKinds.map((kind) => {
    const ranks = results.get(mode)!.filter((r) => r.question.kind === kind).map(firstHitRank);
    return percent(average(ranks.map((rank) => (rank === 1 ? 1 : 0))));
  });
  lines.push(`| ${mode} | ${byKind.join(' | ')} |`);
}

lines.push('', '**Misses** (wrong first result, or results returned for an unanswerable question)', '');
for (const mode of MODES) {
  const misses = results.get(mode)!.filter((r) =>
    r.question.expected.length === 0 ? r.resultKeys.length > 0 : firstHitRank(r) !== 1
  );
  lines.push(`- **${mode}** (${misses.length})`);
  for (const r of misses) {
    const expected = r.question.expected.join(', ') || 'nothing';
    const got = r.resultKeys.join(', ') || 'nothing';
    lines.push(`  - "${r.question.question}": expected ${expected}, got ${got}`);
  }
}

const report = lines.join('\n') + '\n';
await writeFile(new URL('./results.md', import.meta.url), report);
console.log(`\n${report}`);
console.log('Saved to scripts/eval/results.md');

await db.$disconnect();
process.exit(0);
