import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { searchSchema } from '../validations/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { searchMemories, generateAnswer, streamAnswer } from '../services/ai.js';
import { extractCitations, toReferences, usableMemories } from '../lib/citations.js';
import { withTimeout } from '../lib/timeout.js';
import { clientIp, envNumber, rateLimit } from '../lib/rateLimit.js';
import type { SearchResponse } from '../types/index.js';

const SEARCH_TIMEOUT_MS = 10_000;
// Gemini's free tier sometimes takes well over 10 seconds to answer
const ANSWER_TIMEOUT_MS = envNumber('ANSWER_TIMEOUT_MS', 30_000);
const NO_MATCH_ANSWER = "I couldn't find any relevant memories to answer your question.";

const ai = new Hono();

// Every question may call Gemini, which has a small free quota shared by all users.
// Demo visitors share one account, so they're limited per IP address instead.
const perUserLimit = rateLimit({
  limit: envNumber('AI_QUESTIONS_PER_HOUR', 20),
  windowMs: 60 * 60 * 1000,
  key: (c) => {
    const user = c.get('user');
    return user.demo ? `ai:ip:${clientIp(c)}` : `ai:user:${user.userId}`;
  },
  message: "You've reached the hourly question limit. Please try again later.",
});

const appWideLimit = rateLimit({
  limit: envNumber('AI_QUESTIONS_PER_DAY', 200),
  windowMs: 24 * 60 * 60 * 1000,
  key: () => 'ai:all',
  message: 'The daily question limit for this app has been reached. Please try again tomorrow.',
});

ai.use('/*', authMiddleware, perUserLimit, appWideLimit);

ai.post('/search', zValidator('json', searchSchema), async (c) => {
  const { userId } = c.get('user');
  const { query, includeGeneralKnowledge } = c.req.valid('json');

  const searchStart = performance.now();
  const memories = await withTimeout(
    searchMemories(query, userId),
    SEARCH_TIMEOUT_MS,
    'Memory search'
  );
  const searchMs = Math.round(performance.now() - searchStart);

  // Without general knowledge there's nothing to say when no memory is relevant,
  // so the LLM call is skipped
  const usable = usableMemories(memories);
  if (usable.length === 0 && !includeGeneralKnowledge) {
    const response: SearchResponse = {
      answer: NO_MATCH_ANSWER,
      references: toReferences(memories, new Set()),
    };
    return c.json(response);
  }

  const answerStart = performance.now();
  const answer = await withTimeout(
    generateAnswer(query, usable, { includeGeneralKnowledge }),
    ANSWER_TIMEOUT_MS,
    'Answer generation'
  );
  console.log(
    `AI search timing: search ${searchMs}ms, answer ${Math.round(performance.now() - answerStart)}ms`
  );

  const response: SearchResponse = {
    answer,
    references: toReferences(memories, extractCitations(answer)),
  };
  return c.json(response);
});

// Server-Sent Events version of /search. Sends, in order:
//   event "references" - the matching memories, before the answer starts
//   event "token"      - { text } for each piece of the answer as it is written
//   event "done"       - { cited } the citation numbers the answer used
//   event "error"      - sent instead of "done" if generation fails
ai.post('/search/stream', zValidator('json', searchSchema), async (c) => {
  const { userId } = c.get('user');
  const { query, includeGeneralKnowledge } = c.req.valid('json');

  // Search before opening the stream so failures still return a normal error response
  const memories = await withTimeout(
    searchMemories(query, userId),
    SEARCH_TIMEOUT_MS,
    'Memory search'
  );

  return streamSSE(
    c,
    async (stream) => {
      await stream.writeSSE({
        event: 'references',
        data: JSON.stringify(toReferences(memories, new Set())),
      });

      let answer = '';
      const usable = usableMemories(memories);
      if (usable.length === 0 && !includeGeneralKnowledge) {
        answer = NO_MATCH_ANSWER;
        await stream.writeSSE({ event: 'token', data: JSON.stringify({ text: answer }) });
      } else {
        // Give up after the answer timeout, or as soon as the client disconnects
        const signal = AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(ANSWER_TIMEOUT_MS)]);
        for await (const text of streamAnswer(query, usable, { includeGeneralKnowledge }, signal)) {
          answer += text;
          await stream.writeSSE({ event: 'token', data: JSON.stringify({ text }) });
        }
      }

      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ cited: [...extractCitations(answer)] }),
      });
    },
    async (error, stream) => {
      console.error('Streaming answer failed:', error);
      const timedOut = error.name === 'TimeoutError';
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          error: timedOut
            ? 'The AI service took too long to respond. Please try again.'
            : 'Failed to generate an answer. Please try again.',
        }),
      });
    }
  );
});

export default ai;
