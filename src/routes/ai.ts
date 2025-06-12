import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { searchSchema } from '../validations/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { searchMemories, generateAnswer } from '../services/ai.js';
import type { SearchResponse } from '../types/index.js';
import { db } from '../lib/db.js';

const ai = new Hono();

ai.use('/*', authMiddleware);

ai.post('/search', zValidator('json', searchSchema), async (c) => {
  try {
    const user = c.get('user');
    const { query } = c.req.valid('json');

    // Ensure userId is a number for database operations
    const userId = Number(user.userId);
    if (isNaN(userId) || userId <= 0) {
      return c.json({ error: 'Invalid user ID' }, 400);
    }

    // Validate user exists
    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Search for relevant memories with timeout
    let relevantMemories;
    try {
      relevantMemories = await Promise.race([
        searchMemories(query, userId.toString()), // Convert to string for Pinecone
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), 10000)
        ),
      ]);
    } catch (error) {
      console.error('Memory search error:', error);
      return c.json({ 
        error: 'Failed to search memories',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }

    if (!Array.isArray(relevantMemories)) {
      console.error('Invalid search response:', relevantMemories);
      return c.json({ error: 'Invalid search response' }, 500);
    }

    if (relevantMemories.length === 0) {
      return c.json({
        answer: "I couldn't find any relevant memories to answer your question.",
        references: [],
      });
    }

    // Generate answer using RAG with timeout
    let answer;
    try {
      answer = await Promise.race([
        generateAnswer(query, relevantMemories),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Answer generation timeout')), 15000)
        ),
      ]);
    } catch (error) {
      console.error('Answer generation error:', error);
      return c.json({ 
        error: 'Failed to generate answer',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }

    if (typeof answer !== 'string') {
      console.error('Invalid answer response:', answer);
      return c.json({ error: 'Invalid answer response' }, 500);
    }

    const response: SearchResponse = {
      answer,
      references: relevantMemories,
    };

    return c.json(response);
  } catch (error: unknown) {
    console.error('AI search error:', error);
    return c.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default ai; 