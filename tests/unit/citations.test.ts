import { describe, expect, it } from 'vitest';
import { extractCitations, toReferences, usableMemories } from '../../src/lib/citations.js';
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
