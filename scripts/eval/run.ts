// Measures how well each search mode finds the right memories for the questions in
// dataset.ts, and writes the results to scripts/eval/results.md.
// Run with: npm run eval (or npm run eval:test for the held-out test set, written to
// results-test.md, with results by question group and search latency)
//
// Uses a separate eval user, so your own memories are never touched. Only search calls are
// made: embeddings (one per memory, plus one per question for each mode that uses semantic
// search) and one Pinecone rerank request per question in rerank mode. No answers are generated.
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { db } from '../../src/lib/db.js';
import { minRerankScore, searchMemories } from '../../src/services/ai.js';
import type { ScoredMemory, SearchMode } from '../../src/types/index.js';
import { EMBEDDING_PAUSE_MS, loadMemories, sleep, withRetry } from '../lib/load-memories.js';
import { cacheReranking } from '../lib/rerank-cache.js';
import { memories } from './dataset.js';
import {
  evalQuestions as questions,
  isTestSet,
  percentile,
  reportFile,
  setLabel,
  testGroups,
  type SetQuestion as EvalQuestion,
} from './question-set.js';

process.env.LOG_SEARCH = 'false';
await cacheReranking();

const EVAL_EMAIL = 'eval@memory-assistant.local';
const TOP_K = 5;
// On the test set, rerank mode (what the app uses) runs first, so its questions aren't cached
// yet and its times are real: embedding, both searches and reranking
const MODES: SearchMode[] = isTestSet
  ? ['rerank', 'semantic', 'keyword', 'hybrid']
  : ['semantic', 'keyword', 'hybrid', 'rerank'];

// --- 1. Load the dataset into a fresh eval user ---

const user = await db.user.upsert({
  where: { email: EVAL_EMAIL },
  update: {},
  // Not a real login: no password can match this hash
  create: { email: EVAL_EMAIL, name: 'Evaluation', passwordHash: '!' },
});

const keyById = await loadMemories(user.id, memories);

// --- 2. Run every question through every mode ---

interface QuestionResult {
  question: EvalQuestion;
  resultKeys: string[];
  ms: number;
}

// `matches` are best first. `strong` matches are kept at any cutoff, as search does.
interface ScoredQuestion {
  question: EvalQuestion;
  matches: { key: string; score: number; strong: boolean }[];
  ms: number;
}

// Results as search would return them at a given cutoff
const atCutoff = (scored: ScoredQuestion[], cutoff: number): QuestionResult[] =>
  scored.map(({ question, matches, ms }) => ({
    question,
    resultKeys: matches
      .filter((m) => m.score >= cutoff || m.strong)
      .slice(0, TOP_K)
      .map((m) => m.key),
    ms,
  }));

// Overrides an environment setting while `run` executes
async function withEnv<T>(name: string, value: string, run: () => Promise<T>): Promise<T> {
  const previous = process.env[name];
  process.env[name] = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

// Runs every question in one mode, keeping each result's score from `scoreOf`
async function runQuestions(
  mode: SearchMode,
  scoreOf: (m: ScoredMemory) => number | null,
  topK = TOP_K
): Promise<ScoredQuestion[]> {
  const scored: ScoredQuestion[] = [];
  for (const question of questions) {
    const start = performance.now();
    const found = await withRetry(
      // A reranking failure must stop the run rather than quietly fall back to hybrid results
      () =>
        searchMemories(question.question, user.id, {
          topK,
          mode,
          fallbackOnRerankError: false,
        }),
      question.question
    );
    const ms = performance.now() - start;
    scored.push({
      question,
      matches: found.map((m) => ({
        key: keyById.get(m.id) ?? '?',
        score: scoreOf(m) ?? 0,
        strong: mode === 'rerank' && m.strongMatch,
      })),
      ms,
    });
    if (mode !== 'keyword') await sleep(EMBEDDING_PAUSE_MS);
  }
  return scored;
}

// Rerank mode runs once with no rerank cutoff, returning all 20 scored candidates, so its
// results at any cutoff can be worked out without using more of the free rerank quota
const rerankCutoff = minRerankScore();
const RERANK_CANDIDATES = 20;
let rerankScored: ScoredQuestion[] = [];

const results = new Map<SearchMode, QuestionResult[]>();
for (const mode of MODES) {
  console.log(`Running ${questions.length} questions in ${mode} mode...`);
  if (mode === 'rerank') {
    rerankScored = await withEnv('MIN_RERANK_SCORE', '0', () =>
      runQuestions(mode, (m) => m.rerankScore, RERANK_CANDIDATES)
    );
    results.set(mode, atCutoff(rerankScored, rerankCutoff));
  } else {
    results.set(mode, atCutoff(await runQuestions(mode, () => 1), 0));
  }
}

// --- 3. Relevance cutoff sweep ---
// Semantic search runs once more with no cutoff, keeping every match's similarity score,
// so each candidate cutoff can be scored without searching again.

const CUTOFFS = [0.5, 0.55, 0.6, 0.65, 0.7];
const RERANK_CUTOFFS = [0.01, 0.05, 0.1, 0.2, 0.3, 0.5];
const configuredCutoff = process.env.MIN_RELEVANCE_SCORE;

console.log('Running the relevance cutoff sweep...');
const semanticScored = await withEnv('MIN_RELEVANCE_SCORE', '0', () =>
  runQuestions('semantic', (m) => m.score)
);

// --- 4. Score the results ---

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

const answerableKinds = ['paraphrase', 'exact', 'multi', 'long-detail'] as const;
const unanswerableKinds = ['unanswerable', 'close-call'] as const;
const countOf = (kind: EvalQuestion['kind']) => questions.filter((q) => q.kind === kind).length;

const lines: string[] = [
  `# Retrieval evaluation, ${setLabel}`,
  '',
  `Run on ${new Date().toISOString().slice(0, 10)} with ${memories.length} memories and ` +
    `${questions.length} questions (` +
    [...answerableKinds, ...unanswerableKinds].map((k) => `${countOf(k)} ${k}`).join(', ') +
    `), top ${TOP_K} results, relevance cutoff ` +
    `${configuredCutoff ?? '0.55 (default)'}, rerank cutoff ${rerankCutoff} ` +
    `(rerank mode reranks the top 20 hybrid candidates). Generated by ` +
    `\`npm run ${isTestSet ? 'eval:test' : 'eval'}\`.`,
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

if (isTestSet) {
  const rerankResults = results.get('rerank')!;
  lines.push(
    '',
    "**Rerank mode (the app's search) by question group**",
    '',
    '| Group | Questions | Hit@1 | Recall@5 | No-answer accuracy | Close-call accuracy |',
    '|---|---|---|---|---|---|'
  );
  for (const [name, inGroup] of testGroups) {
    const part = rerankResults.filter((r) => inGroup(r.question));
    const s = score(part);
    const closeCalls = part.filter((r) => r.question.kind === 'close-call');
    lines.push(
      `| ${name} | ${part.length} | ${percent(s.hit1)} | ${percent(s.recall)} | ` +
        `${percent(s.noAnswer)} | ` +
        `${percent(average(closeCalls.map((r) => (r.resultKeys.length === 0 ? 1 : 0))))} |`
    );
  }

  const times = rerankResults.map((r) => r.ms);
  lines.push(
    '',
    '**Search latency, rerank mode** (from this machine; each question embedded for the first ' +
      'time, then semantic and keyword search, then reranking)',
    '',
    '| p50 | p95 | Max |',
    '|---|---|---|',
    `| ${Math.round(percentile(times, 50))} ms | ${Math.round(percentile(times, 95))} ms | ` +
      `${Math.round(Math.max(...times))} ms |`
  );
}

const tableHeader = (columns: readonly string[]) => [
  `| Mode | ${columns.join(' | ')} |`,
  `|---|${columns.map(() => '---|').join('')}`,
];

lines.push('', '**Hit@1 by question type**', '', ...tableHeader(answerableKinds));
for (const mode of MODES) {
  const byKind = answerableKinds.map((kind) => {
    const ranks = results.get(mode)!.filter((r) => r.question.kind === kind).map(firstHitRank);
    return percent(average(ranks.map((rank) => (rank === 1 ? 1 : 0))));
  });
  lines.push(`| ${mode} | ${byKind.join(' | ')} |`);
}

lines.push('', '**No-answer accuracy by question type**', '', ...tableHeader(unanswerableKinds));
for (const mode of MODES) {
  const byKind = unanswerableKinds.map((kind) => {
    const kindResults = results.get(mode)!.filter((r) => r.question.kind === kind);
    return percent(average(kindResults.map((r) => (r.resultKeys.length === 0 ? 1 : 0))));
  });
  lines.push(`| ${mode} | ${byKind.join(' | ')} |`);
}

function sweepTable(title: string, scored: ScoredQuestion[], cutoffs: number[]) {
  lines.push(
    '',
    `**${title}** (notes sent = average memories passed to the model per question)`,
    '',
    '| Cutoff | Hit@1 | Recall@5 | No-answer accuracy | Close-call accuracy | Notes sent |',
    '|---|---|---|---|---|---|'
  );
  for (const cutoff of cutoffs) {
    const cutoffResults = atCutoff(scored, cutoff);
    const s = score(cutoffResults);
    const closeCalls = cutoffResults.filter((r) => r.question.kind === 'close-call');
    const closeCallAccuracy = average(closeCalls.map((r) => (r.resultKeys.length === 0 ? 1 : 0)));
    const notesSent = average(cutoffResults.map((r) => r.resultKeys.length));
    lines.push(
      `| ${cutoff.toFixed(2)} | ${percent(s.hit1)} | ${percent(s.recall)} | ${percent(s.noAnswer)} | ` +
        `${percent(closeCallAccuracy)} | ${notesSent.toFixed(1)} |`
    );
  }
}

sweepTable('Relevance cutoff sweep, semantic search', semanticScored, CUTOFFS);
sweepTable('Rerank cutoff sweep, rerank mode', rerankScored, RERANK_CUTOFFS);

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
await writeFile(new URL(`./${reportFile('results')}`, import.meta.url), report);
console.log(`\n${report}`);
console.log(`Saved to scripts/eval/${reportFile('results')}`);

await db.$disconnect();
process.exit(0);
