import { describe, expect, it } from 'vitest';
import { splitIntoChunks } from '../../src/lib/chunk.js';

describe('splitIntoChunks', () => {
  it('returns short text unchanged', () => {
    expect(splitIntoChunks('One sentence. Two sentences.', 100)).toEqual([
      'One sentence. Two sentences.',
    ]);
  });

  it('breaks between sentences and repeats the last sentence in the next piece', () => {
    const text = 'Alpha is first. Bravo is second. Charlie is third. Delta is fourth.';
    expect(splitIntoChunks(text, 35)).toEqual([
      'Alpha is first. Bravo is second.',
      'Bravo is second. Charlie is third.',
      'Charlie is third. Delta is fourth.',
    ]);
  });

  it('treats line breaks as boundaries', () => {
    expect(splitIntoChunks('Shopping list\nMilk\nEggs and bread', 20)).toEqual([
      'Shopping list Milk',
      'Milk Eggs and bread',
    ]);
  });

  it('never returns a piece longer than the limit, even for one very long sentence', () => {
    const chunks = splitIntoChunks(`${'word '.repeat(100)}end.`, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 50)).toBe(true);
  });

  it('keeps every sentence of a long note in some piece', () => {
    const sentences = Array.from({ length: 40 }, (_, i) => `Fact number ${i} is here.`);
    const chunks = splitIntoChunks(sentences.join(' '), 120);
    for (const sentence of sentences) {
      expect(chunks.some((chunk) => chunk.includes(sentence))).toBe(true);
    }
  });
});
