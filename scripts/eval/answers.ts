// Measures the quality of generated answers, not just retrieval: for each question it runs the
// real pipeline (search, then the answer model), then asks a grader model to check the answer
// against the notes it was given. Writes the results to scripts/eval/answers.md.
// Run with: npm run eval:answers (or npm run eval:answers:test for the held-out test set,
// written to answers-test.md, with results by question group and answer latency)
//
// Uses the same eval user as `npm run eval`, reusing its memories when they're already loaded.
// Per question: one embedding (cached), one rerank request and, when notes are found, two chat
// calls (answer and grade). Spaced out to stay under the free tier's per-minute chat limit.
//
// The grader is an LLM too, so its verdicts can be wrong. Every answer is written to the
// report in full, so the verdicts can be checked by hand.
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { db } from '../../src/lib/db.js';
import { generateAnswer, searchMemories } from '../../src/services/ai.js';
import { extractCitations, NO_MATCH_ANSWER, usableMemories } from '../../src/lib/citations.js';
import { loadMemories, sleep, withRetry } from '../lib/load-memories.js';
import { cacheReranking } from '../lib/rerank-cache.js';
import { memories } from './dataset.js';
import {
  evalQuestions,
  isTestSet,
  percentile,
  reportFile,
  setLabel,
  testGroups,
  type SetQuestion,
} from './question-set.js';
import { grade, GRADER_MODEL, type Grade } from './grader.js';

process.env.LOG_SEARCH = 'false';
await cacheReranking();

const EVAL_EMAIL = 'eval@memory-assistant.local';
// Two chat calls per question; 8 seconds apart keeps it under 15 requests a minute
const CHAT_PAUSE_MS = 8000;

type AnswerQuestion = Omit<SetQuestion, 'kind'> & {
  kind: SetQuestion['kind'] | 'timing';
};

// Extra questions that test how answers describe dates, which retrieval scores can't show.
// The demo notes are dated around October 2026: the Europe trip (June) is past, and the
// Amazon interview (12 November) and the flat move (1 November) are upcoming.
const timingQuestions: AnswerQuestion[] = [
  { question: 'What trips will I take in the future?', expected: ['europe-trip'], kind: 'timing' },
  { question: 'When is my Amazon interview?', expected: ['interview'], kind: 'timing' },
  { question: 'When am I moving to the new flat?', expected: ['flat-move'], kind: 'timing' },
];

// The timing questions were written while tuning the prompt, so they aren't part of the test set
const allQuestions: AnswerQuestion[] = isTestSet
  ? evalQuestions
  : [...evalQuestions, ...timingQuestions];

// --- 1. Load the dataset into the eval user ---

const user = await db.user.upsert({
  where: { email: EVAL_EMAIL },
  update: {},
  create: { email: EVAL_EMAIL, name: 'Evaluation', passwordHash: '!' },
});
await loadMemories(user.id, memories);

// --- 2. Answer every question, then grade the answer ---

interface Result {
  question: AnswerQuestion;
  answer: string;
  noteTitles: string[];
  grade: Grade;
  // Citation numbers that don't match any note given to the model
  invalidCitations: number[];
  // How long the answer took to write, or null when no notes were found and no model was called
  answerMs: number | null;
}

const results: Result[] = [];
for (const [i, question] of allQuestions.entries()) {
  console.log(`[${i + 1}/${allQuestions.length}] ${question.question}`);
  const found = await withRetry(
    () => searchMemories(question.question, user.id, { fallbackOnRerankError: false }),
    question.question
  );
  const notes = usableMemories(found);

  // As in the app: with no relevant notes, the model isn't called
  if (notes.length === 0) {
    results.push({
      question,
      answer: NO_MATCH_ANSWER,
      noteTitles: [],
      grade: {
        answersQuestion: false,
        saysNotFound: true,
        unsupportedClaims: [],
        wrongCitations: [],
        timingErrors: [],
      },
      invalidCitations: [],
      answerMs: null,
    });
    continue;
  }

  const answerStart = performance.now();
  const answer = await withRetry(() => generateAnswer(question.question, notes), question.question);
  const answerMs = performance.now() - answerStart;
  await sleep(CHAT_PAUSE_MS);
  const verdict = await withRetry(() => grade(question.question, notes, answer), 'grading');
  await sleep(CHAT_PAUSE_MS);

  results.push({
    question,
    answer,
    noteTitles: notes.map((m) => m.title ?? 'Untitled'),
    grade: verdict,
    invalidCitations: [...extractCitations(answer)].filter((n) => n < 1 || n > notes.length),
    answerMs,
  });
}

// --- 3. Score ---

const expectsAnswer = (r: Result) => r.question.expected.length > 0;
const faithful = (r: Result) => r.grade.unsupportedClaims.length === 0;
const citationsOk = (r: Result) =>
  r.grade.wrongCitations.length === 0 && r.invalidCitations.length === 0;
const datesOk = (r: Result) => r.grade.timingErrors.length === 0;
// Answerable questions must be answered; the others must say the notes don't have it.
// Timing questions count as correct when they're answered without a timing error.
const correct = (r: Result) =>
  faithful(r) &&
  (r.question.kind === 'timing'
    ? datesOk(r)
    : expectsAnswer(r)
      ? r.grade.answersQuestion
      : r.grade.saysNotFound);
const passed = (r: Result) => correct(r) && citationsOk(r) && datesOk(r);

const percent = (part: Result[], test: (r: Result) => boolean) =>
  part.length === 0 ? '-' : `${Math.round((part.filter(test).length / part.length) * 100)}%`;

const kinds = [...new Set(allQuestions.map((q) => q.kind))];
const lines = [
  `# Answer quality evaluation, ${setLabel}`,
  '',
  `Run on ${new Date().toISOString().slice(0, 10)} with ${allQuestions.length} questions. ` +
    `Answers by ${process.env.GEMINI_CHAT_MODEL || 'gemini-flash-lite-latest'}, ` +
    `graded by ${GRADER_MODEL}. ` +
    `Generated by \`npm run ${isTestSet ? 'eval:answers:test' : 'eval:answers'}\`.`,
  '',
  '*Correct: answerable questions answered, others correctly say the notes don\'t have it. ' +
    'Faithful: no claim the notes don\'t support. Citations: every [n] supports its sentence. ' +
    'Dates: nothing past called upcoming, or the reverse. All: every check passed.*',
  '',
  '| Question type | Questions | Correct | Faithful | Citations | Dates | All |',
  '|---|---|---|---|---|---|---|',
];
for (const kind of [...kinds, 'total'] as const) {
  const part = kind === 'total' ? results : results.filter((r) => r.question.kind === kind);
  const label = kind === 'total' ? '**total**' : kind;
  lines.push(
    `| ${label} | ${part.length} | ${percent(part, correct)} | ${percent(part, faithful)} | ` +
      `${percent(part, citationsOk)} | ${percent(part, datesOk)} | ${percent(part, passed)} |`
  );
}

const groupRow = (label: string, part: Result[]) =>
  `| ${label} | ${part.length} | ${percent(part, correct)} | ${percent(part, faithful)} | ` +
  `${percent(part, citationsOk)} | ${percent(part, datesOk)} | ${percent(part, passed)} |`;

if (isTestSet) {
  lines.push(
    '',
    '**By question group**',
    '',
    '| Group | Questions | Correct | Faithful | Citations | Dates | All |',
    '|---|---|---|---|---|---|---|',
    ...testGroups.map(([name, inGroup]) =>
      groupRow(name, results.filter((r) => inGroup(r.question as SetQuestion)))
    )
  );
}

// Includes Gemini's occasional slow responses; retries after a 503 are counted too
const answerTimes = results.flatMap((r) => (r.answerMs === null ? [] : [r.answerMs]));
lines.push(
  '',
  `**Answer latency** (${answerTimes.length} answers written, from this machine, whole ` +
    'answer without streaming)',
  '',
  '| p50 | p95 | Max |',
  '|---|---|---|',
  `| ${Math.round(percentile(answerTimes, 50))} ms | ${Math.round(percentile(answerTimes, 95))} ms ` +
    `| ${Math.round(Math.max(0, ...answerTimes))} ms |`
);

const problemsOf = (r: Result) => [
  ...(correct(r)
    ? []
    : [expectsAnswer(r) ? 'Did not answer the question' : "Did not say the notes don't have it"]),
  ...r.grade.unsupportedClaims.map((p) => `Unsupported: ${p}`),
  ...r.grade.wrongCitations.map((p) => `Citation: ${p}`),
  ...r.invalidCitations.map((n) => `Citation: [${n}] doesn't match any note`),
  ...r.grade.timingErrors.map((p) => `Timing: ${p}`),
];

const failures = results.filter((r) => !passed(r));
const summaryLength = lines.length;
lines.push('', `## Failed checks (${failures.length})`, '');
for (const r of failures) {
  lines.push(`**${r.question.question}** (${r.question.kind})`, '', `> ${r.answer.replace(/\n+/g, ' ')}`, '');
  for (const problem of problemsOf(r)) lines.push(`- ${problem}`);
  lines.push('');
}

lines.push('## All answers', '');
for (const r of results) {
  const notes = r.noteTitles.length > 0 ? r.noteTitles.join('; ') : 'none';
  lines.push(
    `- ${passed(r) ? '✅' : '❌'} **${r.question.question}** (notes: ${notes})`,
    `  > ${r.answer.replace(/\n+/g, ' ')}`
  );
}

const report = lines.join('\n') + '\n';
await writeFile(new URL(`./${reportFile('answers')}`, import.meta.url), report);
console.log(`\n${lines.slice(0, summaryLength).join('\n')}`);
console.log(
  `\n${failures.length} answers failed a check. Full report: scripts/eval/${reportFile('answers')}`
);

await db.$disconnect();
process.exit(0);
