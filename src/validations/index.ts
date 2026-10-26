import { z } from 'zod';

export const signupSchema = z.object({
  email: z.email(),
  name: z.string().min(2).max(50),
  password: z.string().min(8).max(128),
  // Required when SIGNUP_MODE is "invite"
  inviteCode: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().max(128),
});

export const createMemorySchema = z.object({
  title: z.string().max(200).optional(),
  // Keeps each memory within the embedding model's 2,048-token input limit
  content: z.string().min(1).max(8_000),
  tags: z.array(z.string().min(1).max(50)).max(20),
});

export const updateMemorySchema = createMemorySchema.partial();

export const memoryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const searchSchema = z.object({
  query: z.string().min(1).max(1_000),
});

// Query-string values always arrive as strings, and a repeated key
// (?tags=a&tags=b) arrives as an array while a single one is a plain string.
export const listMemoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  tags: z.preprocess(
    (value) => (typeof value === 'string' ? [value] : value),
    z.array(z.string()).max(20).optional()
  ),
  search: z.string().max(200).optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
});
