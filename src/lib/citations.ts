import type { Reference, ScoredMemory } from '../types/index.js';

// In general-knowledge mode the model puts background information after this line,
// separate from what the memories say
export const GENERAL_KNOWLEDGE_MARKER = 'General knowledge:';

// Splits an answer into the part based on memories and the optional general-knowledge part
export function splitAnswer(answer: string): { notes: string; general: string | null } {
  const match = /(^|\n)[*#\s]*General knowledge:[*\s]*/i.exec(answer);
  if (!match) return { notes: answer.trim(), general: null };
  return {
    notes: answer.slice(0, match.index).trim(),
    general: answer.slice(match.index + match[0].length).trim(),
  };
}

// Returns the memory numbers cited in an answer, e.g. "... [1][3]" -> {1, 3}.
// Only the memory-based part counts: general knowledge must never cite memories.
export function extractCitations(answer: string): Set<number> {
  const { notes } = splitAnswer(answer);
  return new Set([...notes.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])));
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
