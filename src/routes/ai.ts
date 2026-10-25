import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { searchSchema } from '../validations/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { searchMemories, generateAnswer, extractCitations } from '../services/ai.js';
import { withTimeout } from '../lib/timeout.js';
import type { SearchResponse } from '../types/index.js';

const SEARCH_TIMEOUT_MS = 10_000;
const ANSWER_TIMEOUT_MS = 15_000;

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
  if (memories.length === 0) {
    const response: SearchResponse = {
      answer: "I couldn't find any relevant memories to answer your question.",
      references: [],
    };
    return c.json(response);
  }

  const answer = await withTimeout(
    generateAnswer(query, memories),
    ANSWER_TIMEOUT_MS,
    'Answer generation'
  );

  const cited = extractCitations(answer);
  const response: SearchResponse = {
    answer,
    references: memories.map((memory, i) => ({
      ...memory,
      citation: i + 1,
      cited: cited.has(i + 1),
    })),
  };
  return c.json(response);
});

export default ai;
