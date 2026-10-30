import { describe, expect, it } from 'vitest';
import { bestScorePerCandidate, selectReranked } from '../../src/lib/rerank.js';

describe('bestScorePerCandidate', () => {
  it("gives each candidate its best piece's score", () => {
    // Pieces 0-2 belong to candidate 0, piece 3 to candidate 1
    const owners = [0, 0, 0, 1];
    const ranked = [
      { index: 2, score: 0.9 },
      { index: 3, score: 0.4 },
      { index: 0, score: 0.1 },
      { index: 1, score: 0.05 },
    ];
    expect(bestScorePerCandidate(owners, ranked)).toEqual([
      { index: 0, score: 0.9 },
      { index: 1, score: 0.4 },
    ]);
  });
});

describe('selectReranked', () => {
  const candidates = [10, 20, 30, 40];

  it('orders candidates by rerank score and maps positions back to ids', () => {
    const ranked = [
      { index: 0, score: 0.2 },
      { index: 2, score: 0.9 },
      { index: 1, score: 0.5 },
    ];
    expect(selectReranked(candidates, ranked, 0, 5)).toEqual([
      { id: 30, score: 0.9 },
      { id: 20, score: 0.5 },
      { id: 10, score: 0.2 },
    ]);
  });

  it('drops candidates below the cutoff and keeps at most topK', () => {
    const ranked = [
      { index: 0, score: 0.95 },
      { index: 1, score: 0.8 },
      { index: 2, score: 0.6 },
      { index: 3, score: 0.05 },
    ];
    expect(selectReranked(candidates, ranked, 0.1, 2).map((r) => r.id)).toEqual([10, 20]);
  });

  it('returns nothing when no candidate clears the cutoff', () => {
    expect(selectReranked(candidates, [{ index: 0, score: 0.02 }], 0.1, 5)).toEqual([]);
  });

  it('keeps candidates in alwaysKeep even below the cutoff, in rerank order', () => {
    const ranked = [
      { index: 0, score: 0.5 },
      { index: 1, score: 0.02 },
      { index: 2, score: 0.01 },
    ];
    expect(selectReranked(candidates, ranked, 0.1, 5, new Set([30])).map((r) => r.id)).toEqual([
      10, 30,
    ]);
  });

  it('ignores positions outside the candidate list', () => {
    expect(selectReranked(candidates, [{ index: 9, score: 0.9 }], 0, 5)).toEqual([]);
  });
});
