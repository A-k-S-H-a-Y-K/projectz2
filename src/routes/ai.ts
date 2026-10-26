import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { searchSchema } from '../validations/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { searchMemories, generateAnswer, streamAnswer } from '../services/ai.js';
import { extractCitations, toReferences, usableMemories } from '../lib/citations.js';
import { withTimeout } from '../lib/timeout.js';
import type { SearchResponse } from '../types/index.js';

const SEARCH_TIMEOUT_MS = 10_000;
const ANSWER_TIMEOUT_MS = 15_000;
const NO_MATCH_ANSWER = "I couldn't find any relevant memories to answer your question.";

const ai = new Hono();

ai.use('/*', authMiddleware);

ai.post('/search', zValidator('json', searchSchema), async (c) => {
  const { userId } = c.get('user');
  const { query } = c.req.valid('json');

  const memories = await withTimeout(
    searchMemories(query, userId),
    SEARCH_TIMEOUT_MS,
    'Memory search'
  );

  // Skip the LLM call entirely when nothing relevant was found
  const usable = usableMemories(memories);
  if (usable.length === 0) {
    const response: SearchResponse = {
      answer: NO_MATCH_ANSWER,
      references: toReferences(memories, new Set()),
    };
    return c.json(response);
  }

  const answer = await withTimeout(
    generateAnswer(query, usable),
    ANSWER_TIMEOUT_MS,
    'Answer generation'
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
  const { query } = c.req.valid('json');

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
      if (usable.length === 0) {
        answer = NO_MATCH_ANSWER;
        await stream.writeSSE({ event: 'token', data: JSON.stringify({ text: answer }) });
      } else {
        for await (const text of streamAnswer(query, usable)) {
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
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: 'Failed to generate answer' }),
      });
    }
  );
});

export default ai;
