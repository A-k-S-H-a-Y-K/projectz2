import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { Prisma } from '@prisma/client';
import {
  createMemorySchema,
  updateMemorySchema,
  listMemoriesQuerySchema,
  memoryIdParamSchema,
} from '../validations/index.js';
import { db } from '../lib/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { storeMemoryEmbedding, deleteMemoryEmbedding } from '../services/ai.js';

const memories = new Hono();

memories.use('/*', authMiddleware);

// Returns the memory only if it belongs to the given user
const findOwnMemory = (id: number, userId: number) =>
  db.memory.findFirst({ where: { id, userId } });

// Create memory
memories.post('/', zValidator('json', createMemorySchema), async (c) => {
  const { userId } = c.get('user');
  const data = c.req.valid('json');

  const memory = await db.memory.create({
    data: { ...data, userId },
  });

  // Store embedding asynchronously
  storeMemoryEmbedding(memory).catch((error: unknown) => {
    console.error('Failed to store memory embedding:', error);
  });

  return c.json(memory, 201);
});

// List memories with pagination and filters
memories.get('/', zValidator('query', listMemoriesQuerySchema), async (c) => {
  const { userId } = c.get('user');
  const { page, limit, search, tags, startDate, endDate } = c.req.valid('query');

  const where: Prisma.MemoryWhereInput = { userId };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { content: { contains: search, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  if (tags && tags.length > 0) {
    where.tags = { hasSome: tags };
  }

  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }

  const [items, total] = await Promise.all([
    db.memory.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    db.memory.count({ where }),
  ]);

  return c.json({
    memories: items,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});

// Get single memory
memories.get('/:id', zValidator('param', memoryIdParamSchema), async (c) => {
  const { id } = c.req.valid('param');

  const memory = await findOwnMemory(id, c.get('user').userId);
  if (!memory) {
    return c.json({ error: 'Memory not found' }, 404);
  }

  return c.json(memory);
});

// Update memory
memories.put(
  '/:id',
  zValidator('param', memoryIdParamSchema),
  zValidator('json', updateMemorySchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');

    if (!(await findOwnMemory(id, c.get('user').userId))) {
      return c.json({ error: 'Memory not found' }, 404);
    }

    const updatedMemory = await db.memory.update({ where: { id }, data });

    // Update embedding asynchronously
    storeMemoryEmbedding(updatedMemory).catch((error: unknown) => {
      console.error('Failed to update memory embedding:', error);
    });

    return c.json(updatedMemory);
  }
);

// Delete memory
memories.delete('/:id', zValidator('param', memoryIdParamSchema), async (c) => {
  const { id } = c.req.valid('param');

  if (!(await findOwnMemory(id, c.get('user').userId))) {
    return c.json({ error: 'Memory not found' }, 404);
  }

  await db.memory.delete({ where: { id } });

  // Delete embedding asynchronously
  deleteMemoryEmbedding(id).catch((error: unknown) => {
    console.error('Failed to delete memory embedding:', error);
  });

  return c.json({ success: true });
});

export default memories;
