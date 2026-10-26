export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// Splits an answer into the part based on the user's notes and the optional
// "General knowledge:" part. Matches splitAnswer in the API's src/lib/citations.ts.
export function splitAnswer(answer: string): { notes: string; general: string | null } {
  const match = /(^|\n)[*#\s]*General knowledge:[*\s]*/i.exec(answer);
  if (!match) return { notes: answer.trim(), general: null };
  return {
    notes: answer.slice(0, match.index).trim(),
    general: answer.slice(match.index + match[0].length).trim(),
  };
}
