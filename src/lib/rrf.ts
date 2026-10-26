// Reciprocal Rank Fusion: merges ranked lists by summing 1 / (k + rank) for each list an id
// appears in. Items ranked well in either list rise to the top, and items in both get a boost.
// k = 60 is the standard constant from the original RRF paper.
export function reciprocalRankFusion(rankedLists: number[][], k = 60): number[] {
  const fused = new Map<number, number>();
  for (const list of rankedLists) {
    list.forEach((id, rank) => fused.set(id, (fused.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return [...fused.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
