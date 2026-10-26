import { describe, expect, it } from 'vitest';
import {
  extractCitations,
  splitAnswer,
  toReferences,
  usableMemories,
} from '../../src/lib/citations.js';
import { scoredMemory } from '../helpers.js';

describe('extractCitations', () => {
  it('collects every cited number once', () => {
    expect(extractCitations('Goa [1]. Gym [3][1].')).toEqual(new Set([1, 3]));
  });

  it('returns nothing when the answer has no citations', () => {
    expect(extractCitations("I couldn't find it in your memories.")).toEqual(new Set());
  });

  it('ignores brackets that are not numbers', () => {
    expect(extractCitations('See [note] and [2a]')).toEqual(new Set());
  });

  it('ignores citations in the general-knowledge part', () => {
    expect(extractCitations('Goa [1].\nGeneral knowledge:\nBeaches [2].')).toEqual(new Set([1]));
  });
});

describe('splitAnswer', () => {
  it('separates the memory-based part from general knowledge', () => {
    expect(splitAnswer('From your notes [1].\n\nGeneral knowledge:\nSome background.')).toEqual({
      notes: 'From your notes [1].',
      general: 'Some background.',
    });
  });

  it('accepts the marker with markdown formatting', () => {
    expect(splitAnswer('Notes.\n**General knowledge:**\nBackground.').general).toBe('Background.');
  });

  it('returns no general part when the marker is missing', () => {
    expect(splitAnswer('Only notes [1].')).toEqual({ notes: 'Only notes [1].', general: null });
  });
});

describe('toReferences', () => {
  it('numbers usable memories in order and skips suspicious ones', () => {
    const memories = [
      scoredMemory({ id: 10 }),
      scoredMemory({ id: 11, suspicious: true }),
      scoredMemory({ id: 12 }),
    ];

    const references = toReferences(memories, new Set([2]));

    expect(references.map((r) => [r.id, r.citation, r.cited])).toEqual([
      [10, 1, false],
      [11, null, false],
      [12, 2, true],
    ]);
  });
});

describe('usableMemories', () => {
  it('drops memories flagged as suspicious', () => {
    const memories = [scoredMemory({ id: 1 }), scoredMemory({ id: 2, suspicious: true })];
    expect(usableMemories(memories).map((m) => m.id)).toEqual([1]);
  });
});
