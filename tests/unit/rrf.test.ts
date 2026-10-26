import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from '../../src/lib/rrf.js';

describe('reciprocalRankFusion', () => {
  it('ranks items found by both lists first', () => {
    const fused = reciprocalRankFusion([
      [1, 2, 3],
      [3, 4],
    ]);
    expect(fused[0]).toBe(3);
    expect(fused).toHaveLength(4);
  });

  it('keeps the order of a single list', () => {
    expect(reciprocalRankFusion([[5, 2, 9]])).toEqual([5, 2, 9]);
  });

  it('lets an item found by both lists overtake one ranked first by only one list', () => {
    expect(reciprocalRankFusion([[1, 2], [2]])).toEqual([2, 1]);
  });

  it('handles empty lists', () => {
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });
});
