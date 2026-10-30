import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { searchSchema } from '../validations/index.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  searchMemories,
  generateAnswer,
  rewriteFollowUp,
  streamAnswer,
} from '../services/ai.js';
import {
  extractCitations,
  NO_MATCH_ANSWER,
  toReferences,
  usableMemories,
} from '../lib/citations.js';
import { withTimeout } from '../lib/timeout.js';
import { clientIp, envNumber, rateLimit } from '../lib/rateLimit.js';
import type { ConversationTurn, SearchResponse } from '../types/index.js';

// Search embeds the question, queries Pinecone and reranks; the first search after the server
// starts (or wakes up on a free host) can take over 10 seconds while connections are set up
const SEARCH_TIMEOUT_MS = 20_000;
// Gemini's free tier sometimes takes well over 10 seconds to answer
const ANSWER_TIMEOUT_MS = envNumber('ANSWER_TIMEOUT_MS', 30_000);
const REWRITE_TIMEOUT_MS = 8_000;

// A follow-up is rewritten to stand on its own before searching. If that fails, the question
// is searched as asked: a worse search is better than no answer.
async function questionToSearch(query: string, history: ConversationTurn[]): Promise<string> {
  if (history.length === 0) return query;
  try {
    const rewritten = await withTimeout(
      rewriteFollowUp(query, history),
      REWRITE_TIMEOUT_MS,
      'Follow-up rewrite'
    );
    if (rewritten !== query) console.log(`Follow-up rewritten: "${query}" -> "${rewritten}"`);
    return rewritten;
  } catch (error) {
    console.warn('Rewriting the follow-up failed, searching the question as asked:', error);
    return query;
  }
}

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
  const { query: asked, includeGeneralKnowledge, history } = c.req.valid('json');
  const query = await questionToSearch(asked, history);

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
      searchedFor: query,
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
    searchedFor: query,
  };
  return c.json(response);
});

// Server-Sent Events version of /search. Sends, in order:
//   event "query"      - { searchedFor } the question searched for, after any follow-up rewrite
//   event "references" - the matching memories, before the answer starts
//   event "token"      - { text } for each piece of the answer as it is written
//   event "done"       - { cited } the citation numbers the answer used
//   event "error"      - sent instead of "done" if generation fails
ai.post('/search/stream', zValidator('json', searchSchema), async (c) => {
  const { userId } = c.get('user');
  const { query: asked, includeGeneralKnowledge, history } = c.req.valid('json');
  const query = await questionToSearch(asked, history);

  // Search before opening the stream so failures still return a normal error response
  const memories = await withTimeout(
    searchMemories(query, userId),
    SEARCH_TIMEOUT_MS,
    'Memory search'
  );

  // The AI SDK reports a timeout as a plain AbortError, so check this signal to tell them apart
  const timeout = AbortSignal.timeout(ANSWER_TIMEOUT_MS);

  return streamSSE(
    c,
    async (stream) => {
      await stream.writeSSE({ event: 'query', data: JSON.stringify({ searchedFor: query }) });
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
        const signal = AbortSignal.any([c.req.raw.signal, timeout]);
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
      const timedOut = timeout.aborted || error.name === 'TimeoutError';
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
