import type { Reference, ScoredMemory } from '../types/index.js';

// Returns the memory numbers cited in an answer, e.g. "... [1][3]" -> {1, 3}
export function extractCitations(answer: string): Set<number> {
  return new Set([...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])));
}

// Only memories that passed the injection check are shown to the model
export const usableMemories = (memories: ScoredMemory[]) =>
  memories.filter((memory) => !memory.suspicious);

// Usable memories are numbered 1..n in the order given to the model, matching its [n]
// citations. Suspicious ones are still listed so a client can warn about them.
export function toReferences(memories: ScoredMemory[], cited: Set<number>): Reference[] {
  let citation = 0;
  return memories.map((memory) => {
    if (memory.suspicious) {
      return { ...memory, citation: null, cited: false };
    }
    citation += 1;
    return { ...memory, citation, cited: cited.has(citation) };
  });
}
