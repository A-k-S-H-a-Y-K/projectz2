// Measures follow-up questions: for each short conversation, searches the follow-up as asked
// and after rewriting it with the conversation, and checks which finds the right note.
// Writes the results to scripts/eval/followups.md.
// Run with: npm run eval:followups
//
// Uses the same eval user as `npm run eval`, reusing its memories when they're already loaded.
// The first answer in each conversation is written here rather than generated, so each
// conversation costs one chat call (the rewrite) plus two searches.
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { db } from '../../src/lib/db.js';
import { rewriteFollowUp, searchMemories } from '../../src/services/ai.js';
import { loadMemories, sleep, withRetry } from '../lib/load-memories.js';
import { cacheReranking } from '../lib/rerank-cache.js';
import { memories } from './dataset.js';
import type { ConversationTurn } from '../../src/types/index.js';

process.env.LOG_SEARCH = 'false';
await cacheReranking();

const EVAL_EMAIL = 'eval@memory-assistant.local';
const CHAT_PAUSE_MS = 5000;

interface Conversation {
  first: ConversationTurn;
  followUp: string;
  // The note the follow-up is about, or null when the notes don't answer it
  expected: string | null;
}

const conversations: Conversation[] = [
  {
    first: {
      question: 'Where did I try scuba diving?',
      answer: 'You tried scuba diving at Grande Island on your Goa trip in March 2026 [1].',
    },
    followUp: 'Who did I go with?',
    expected: 'goa-trip',
  },
  {
    first: {
      question: 'What did Dr. Mehta prescribe?',
      answer: 'Dr. Mehta prescribed a 60,000 IU vitamin D capsule once a week [1].',
    },
    followUp: 'How long do I take it for?',
    expected: 'doctor-visit',
  },
  {
    first: {
      question: 'Who is my mentor at the internship?',
      answer: 'Your mentor at Zentrix Labs is Priya [1].',
    },
    followUp: 'What language am I using there?',
    expected: 'internship',
  },
  {
    first: {
      question: 'When is my Amazon interview?',
      answer: 'Your Amazon interview is on 12 November [1].',
    },
    followUp: 'What should I focus on for it?',
    expected: 'interview',
  },
  {
    first: {
      question: 'When do I fly to London?',
      answer: 'You fly from Mumbai to London on 4 June 2026 on Air India AI 131 [1].',
    },
    followUp: 'Where am I staying there?',
    expected: 'europe-trip',
  },
  {
    first: {
      question: 'Who is organising the college reunion?',
      answer: 'Rahul is organising the college reunion on 20 December [1].',
    },
    followUp: 'How much is he collecting?',
    expected: 'reunion',
  },
  {
    first: {
      question: 'What medicine does Dad take?',
      answer: 'Your dad takes Telma 40 for blood pressure every morning after breakfast [1].',
    },
    followUp: 'Where is it refilled from?',
    expected: 'dad-medicine',
  },
  // A new topic: the rewrite should leave it alone
  {
    first: {
      question: 'Where did I try scuba diving?',
      answer: 'You tried scuba diving at Grande Island on your Goa trip in March 2026 [1].',
    },
    followUp: 'When is my bike due for service?',
    expected: 'bike-service',
  },
  // Not in the notes: the rewrite shouldn't make search return something anyway
  {
    first: {
      question: 'Who is my mentor at the internship?',
      answer: 'Your mentor at Zentrix Labs is Priya [1].',
    },
    followUp: 'What is her phone number?',
    expected: null,
  },
];

const user = await db.user.upsert({
  where: { email: EVAL_EMAIL },
  update: {},
  create: { email: EVAL_EMAIL, name: 'Evaluation', passwordHash: '!' },
});
const keyById = await loadMemories(user.id, memories);

// Right when the expected note comes first, or when nothing comes back for an unanswerable one
async function check(question: string, expected: string | null) {
  const found = await withRetry(
    () => searchMemories(question, user.id, { fallbackOnRerankError: false }),
    question
  );
  const keys = found.map((m) => keyById.get(m.id) ?? '?');
  const right = expected === null ? keys.length === 0 : keys[0] === expected;
  return { right, got: keys.slice(0, 3).join(', ') || 'nothing' };
}

const rows: string[] = [];
let rightAsAsked = 0;
let rightRewritten = 0;

for (const [i, c] of conversations.entries()) {
  console.log(`[${i + 1}/${conversations.length}] ${c.followUp}`);
  const rewritten = await withRetry(() => rewriteFollowUp(c.followUp, [c.first]), 'rewrite');
  const asAsked = await check(c.followUp, c.expected);
  const after = await check(rewritten, c.expected);
  if (asAsked.right) rightAsAsked += 1;
  if (after.right) rightRewritten += 1;

  const mark = (r: { right: boolean; got: string }) => `${r.right ? '✅' : '❌'} ${r.got}`;
  rows.push(
    `| ${c.first.question} | ${c.followUp} | ${rewritten === c.followUp ? '(unchanged)' : rewritten} | ` +
      `${c.expected ?? 'nothing'} | ${mark(asAsked)} | ${mark(after)} |`
  );
  await sleep(CHAT_PAUSE_MS);
}

const total = conversations.length;
const lines = [
  '# Follow-up question evaluation',
  '',
  `Run on ${new Date().toISOString().slice(0, 10)} with ${total} two-question conversations. ` +
    'Generated by `npm run eval:followups`.',
  '',
  `**Right note first: ${rightAsAsked} of ${total} searching the follow-up as asked, ` +
    `${rightRewritten} of ${total} after rewriting it.**`,
  '',
  '*For the last conversation the notes don\'t have the answer, so "right" means nothing was returned.*',
  '',
  '| First question | Follow-up | Rewritten | Expected | As asked (top 3) | Rewritten (top 3) |',
  '|---|---|---|---|---|---|',
  ...rows,
];

const report = lines.join('\n') + '\n';
await writeFile(new URL('./followups.md', import.meta.url), report);
console.log(`\n${report}`);
console.log('Saved to scripts/eval/followups.md');

await db.$disconnect();
process.exit(0);
