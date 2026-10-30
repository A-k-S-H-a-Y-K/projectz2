import type { Memory } from '@prisma/client';
import { generateToken } from '../src/lib/auth.js';
import type { ScoredMemory } from '../src/types/index.js';

export function memory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 1,
    userId: 1,
    title: 'Trip to Goa',
    content: 'Went to Goa in March with college friends.',
    tags: ['travel'],
    createdAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

export function scoredMemory(overrides: Partial<ScoredMemory> = {}): ScoredMemory {
  return {
    ...memory(overrides),
    score: 0.7,
    rerankScore: null,
    strongMatch: false,
    matchedBy: ['semantic'],
    suspicious: false,
    ...overrides,
  };
}

export async function authHeader(userId = 1, { demo = false } = {}) {
  const token = await generateToken({ userId, email: `user${userId}@example.com`, demo });
  return { Authorization: `Bearer ${token}` };
}
