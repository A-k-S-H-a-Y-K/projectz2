import { describe, expect, it } from 'vitest';
import { createMemorySchema, listMemoriesQuerySchema } from '../../src/validations/index.js';

// Query-string values arrive as strings, and a repeated key arrives as an array
describe('listMemoriesQuerySchema', () => {
  it('converts page and limit to numbers', () => {
    expect(listMemoriesQuerySchema.parse({ page: '2', limit: '5' })).toMatchObject({
      page: 2,
      limit: 5,
    });
  });

  it('defaults to the first page of 10', () => {
    expect(listMemoriesQuerySchema.parse({})).toMatchObject({ page: 1, limit: 10 });
  });

  it('accepts a single tag as well as several', () => {
    expect(listMemoriesQuerySchema.parse({ tags: 'travel' }).tags).toEqual(['travel']);
    expect(listMemoriesQuerySchema.parse({ tags: ['a', 'b'] }).tags).toEqual(['a', 'b']);
  });

  it('rejects a limit above 100', () => {
    expect(listMemoriesQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});

describe('createMemorySchema', () => {
  it('accepts a normal memory', () => {
    const result = createMemorySchema.safeParse({ content: 'Went to Goa', tags: ['travel'] });
    expect(result.success).toBe(true);
  });

  it('rejects content longer than the embedding model accepts', () => {
    const result = createMemorySchema.safeParse({ content: 'a'.repeat(8_001), tags: [] });
    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    expect(createMemorySchema.safeParse({ content: '', tags: [] }).success).toBe(false);
  });
});
