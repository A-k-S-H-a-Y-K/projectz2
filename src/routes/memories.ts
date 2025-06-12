import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createMemorySchema, updateMemorySchema, paginationSchema, memoryFiltersSchema } from '../validations/index.js';
import { db } from '../lib/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { storeMemoryEmbedding } from '../services/ai.js';
import { Prisma } from '@prisma/client';
import type { MemoryWhereInput } from '../types/index.js';

const memories = new Hono();

memories.use('/*', authMiddleware);

// Create memory
memories.post('/', zValidator('json', createMemorySchema), async (c) => {
  try {
    const user = c.get('user');
    const data = c.req.valid('json');

    const memory = await db.memory.create({
      data: {
        ...data,
        userId: user.userId,
      },
    });

    // Store embedding asynchronously
    storeMemoryEmbedding(memory).catch((error: unknown) => {
      console.error('Failed to store memory embedding:', error);
    });

    return c.json(memory, 201);
  } catch (error: unknown) {
    console.error('Create memory error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// List memories with pagination and filters
memories.get('/', zValidator('query', paginationSchema), zValidator('query', memoryFiltersSchema), async (c) => {
  try {
    const user = c.get('user');
    const { page = 1, limit = 10 } = c.req.valid('query');
    const { search, tags, startDate, endDate } = c.req.valid('query');

    const where: MemoryWhereInput = {
      userId: user.userId,
    };

    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          content: {
            contains: search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags,
      };
    }

    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    const [memories, total] = await Promise.all([
      db.memory.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.memory.count({ where }),
    ]);

    return c.json({
      memories,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error('List memories error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get single memory
memories.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'), 10);

    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid memory ID format' }, 400);
    }

    const memory = await db.memory.findFirst({
      where: {
        id,
        userId: user.userId,
      },
    });

    if (!memory) {
      return c.json({ error: 'Memory not found' }, 404);
    }

    return c.json(memory);
  } catch (error: unknown) {
    console.error('Get memory error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update memory
memories.put('/:id', zValidator('json', updateMemorySchema), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'), 10);

    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid memory ID format' }, 400);
    }

    const data = c.req.valid('json');

    const memory = await db.memory.findFirst({
      where: {
        id,
        userId: user.userId,
      },
    });

    if (!memory) {
      return c.json({ error: 'Memory not found' }, 404);
    }

    const updatedMemory = await db.memory.update({
      where: { id },
      data,
    });

    // Update embedding asynchronously
    storeMemoryEmbedding(updatedMemory).catch((error: unknown) => {
      console.error('Failed to update memory embedding:', error);
    });

    return c.json(updatedMemory);
  } catch (error: unknown) {
    console.error('Update memory error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete memory
memories.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'), 10);

    if (isNaN(id) || id <= 0) {
      return c.json({ error: 'Invalid memory ID format' }, 400);
    }

    const memory = await db.memory.findFirst({
      where: {
        id,
        userId: user.userId,
      },
    });

    if (!memory) {
      return c.json({ error: 'Memory not found' }, 404);
    }

    await db.memory.delete({
      where: { id },
    });

    // Delete from Pinecone asynchronously
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeEnvironment = process.env.PINECONE_ENVIRONMENT;
    const pineconeIndexName = process.env.PINECONE_INDEX_NAME;

    if (pineconeApiKey && pineconeEnvironment && pineconeIndexName) {
      try {
        const { Pinecone } = await import('@pinecone-database/pinecone');
        const pinecone = new Pinecone({ 
          apiKey: pineconeApiKey,
          environment: pineconeEnvironment,
        });
        const index = pinecone.index(pineconeIndexName);
        await index.deleteOne(id.toString());
      } catch (err: unknown) {
        console.error('Pinecone deletion error:', err);
        // Don't fail the request if Pinecone deletion fails
      }
    } else {
      console.warn('Pinecone configuration missing, skipping vector deletion');
    }

    return c.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete memory error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default memories; 