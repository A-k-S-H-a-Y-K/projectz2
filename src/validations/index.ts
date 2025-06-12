import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(50),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const createMemorySchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1),
  tags: z.array(z.string()),
});

export const updateMemorySchema = createMemorySchema.partial();

export const searchSchema = z.object({
  query: z.string().min(1),
});

export const paginationSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(10),
});

export const memoryFiltersSchema = z.object({
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}); 