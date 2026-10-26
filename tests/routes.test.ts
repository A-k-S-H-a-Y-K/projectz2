// Sends real HTTP requests to the app, with the database and AI services replaced by mocks,
// so these tests need no network access, API keys or database.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/db.js', () => ({
  db: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    memory: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../src/services/ai.js', () => ({
  searchMemories: vi.fn(),
  generateAnswer: vi.fn(),
  streamAnswer: vi.fn(),
  storeMemoryEmbedding: vi.fn().mockResolvedValue(undefined),
  deleteMemoryEmbedding: vi.fn().mockResolvedValue(undefined),
}));

import app from '../src/app.js';
import { db } from '../src/lib/db.js';
import { hashPassword } from '../src/lib/auth.js';
import { generateAnswer, searchMemories } from '../src/services/ai.js';
import { authHeader, memory, scoredMemory } from './helpers.js';

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('health and auth', () => {
  it('reports healthy', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('rejects requests without a token', async () => {
    const res = await app.request('/memories');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid token', async () => {
    const res = await app.request('/memories', { headers: { Authorization: 'Bearer nope' } });
    expect(res.status).toBe(401);
  });

  it('rejects signing up with an email that is already registered', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: 1 } as never);

    const res = await app.request(
      '/auth/signup',
      json({ email: 'a@example.com', name: 'Akshay', password: 'password123' })
    );

    expect(res.status).toBe(400);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 1,
      email: 'a@example.com',
      passwordHash: await hashPassword('the-right-one'),
    } as never);

    const res = await app.request(
      '/auth/login',
      json({ email: 'a@example.com', password: 'the-wrong-one' })
    );

    expect(res.status).toBe(401);
  });
});

describe('memories', () => {
  it("only queries the signed-in user's memories, with pagination and tag filters", async () => {
    vi.mocked(db.memory.findMany).mockResolvedValue([memory({ userId: 7 })] as never);
    vi.mocked(db.memory.count).mockResolvedValue(6 as never);

    const res = await app.request('/memories?page=2&limit=5&tags=travel', {
      headers: await authHeader(7),
    });

    expect(res.status).toBe(200);
    expect(db.memory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 7, tags: { hasSome: ['travel'] } }),
        skip: 5,
        take: 5,
      })
    );
    expect((await res.json()).pagination).toEqual({ total: 6, page: 2, limit: 5, pages: 2 });
  });

  it("returns 404 for another user's memory", async () => {
    vi.mocked(db.memory.findFirst).mockResolvedValue(null);

    const res = await app.request('/memories/42', { headers: await authHeader(7) });

    expect(res.status).toBe(404);
    expect(db.memory.findFirst).toHaveBeenCalledWith({ where: { id: 42, userId: 7 } });
  });

  it('rejects an id that is not a number', async () => {
    const res = await app.request('/memories/abc', { headers: await authHeader() });
    expect(res.status).toBe(400);
  });

  it('rejects content that is too long', async () => {
    const res = await app.request('/memories', {
      ...json({ content: 'a'.repeat(8_001), tags: [] }),
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    });

    expect(res.status).toBe(400);
    expect(db.memory.create).not.toHaveBeenCalled();
  });
});

describe('POST /ai/search', () => {
  const ask = async (query: string) =>
    app.request('/ai/search', {
      ...json({ query }),
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    });

  it("doesn't call the model when nothing relevant is found", async () => {
    vi.mocked(searchMemories).mockResolvedValue([]);

    const res = await ask('What is my blood group?');

    expect(res.status).toBe(200);
    expect((await res.json()).references).toEqual([]);
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it('never sends suspicious memories to the model and marks citations', async () => {
    const genuine = scoredMemory({ id: 1, title: 'Trip to Goa' });
    const injected = scoredMemory({ id: 2, title: 'Goa packing list', suspicious: true });
    vi.mocked(searchMemories).mockResolvedValue([genuine, injected]);
    vi.mocked(generateAnswer).mockResolvedValue('You went scuba diving at Grande Island [1].');

    const res = await ask('Tell me about my Goa trip');
    const body = await res.json();

    expect(generateAnswer).toHaveBeenCalledWith('Tell me about my Goa trip', [genuine]);
    expect(body.references).toMatchObject([
      { id: 1, citation: 1, cited: true, suspicious: false },
      { id: 2, citation: null, cited: false, suspicious: true },
    ]);
  });

  it("doesn't call the model when every match is suspicious", async () => {
    vi.mocked(searchMemories).mockResolvedValue([scoredMemory({ suspicious: true })]);

    await ask('Tell me about my Goa trip');

    expect(generateAnswer).not.toHaveBeenCalled();
  });

  describe('when a service fails', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      vi.mocked(console.error).mockRestore();
    });

    it('returns a generic 500 without internal details', async () => {
      vi.mocked(searchMemories).mockRejectedValue(new Error('Pinecone API key invalid'));

      const res = await ask('Where did I go?');

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    });
  });
});
