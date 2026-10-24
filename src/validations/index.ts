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

export const memoryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const searchSchema = z.object({
  query: z.string().min(1),
});

// Query-string values always arrive as strings, and a repeated key
// (?tags=a&tags=b) arrives as an array while a single one is a plain string.
export const listMemoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  tags: z.preprocess(
    (value) => (typeof value === 'string' ? [value] : value),
    z.array(z.string()).optional()
  ),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
