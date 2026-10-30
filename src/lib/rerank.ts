// Long candidates are sent to the reranker as several pieces. `owners[i]` is the candidate
// that piece i belongs to. Each candidate gets its best piece's score.
export function bestScorePerCandidate(
  owners: number[],
  ranked: { index: number; score: number }[]
): { index: number; score: number }[] {
  const best = new Map<number, number>();
  for (const { index, score } of ranked) {
    const owner = owners[index];
    if (owner !== undefined && score > (best.get(owner) ?? -1)) best.set(owner, score);
  }
  return [...best].map(([index, score]) => ({ index, score }));
}

// A reranker returns each candidate's position in the list it was given (`index`) and a
// relevance score from 0 to 1. Keeps the candidates that clear the cutoff, plus any in
// `alwaysKeep`, best first.
export function selectReranked(
  candidateIds: number[],
  ranked: { index: number; score: number }[],
  minScore: number,
  topK: number,
  alwaysKeep: Set<number> = new Set()
): { id: number; score: number }[] {
  return [...ranked]
    .sort((a, b) => b.score - a.score)
    .filter((result) => {
      const id = candidateIds[result.index];
      return id !== undefined && (result.score >= minScore || alwaysKeep.has(id));
    })
    .slice(0, topK)
    .map((result) => ({ id: candidateIds[result.index], score: result.score }));
}
