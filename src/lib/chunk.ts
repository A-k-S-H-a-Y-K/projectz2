// Splits long text into overlapping pieces of at most `maxChars`, breaking between sentences
// where possible. Each piece starts with the last sentence of the one before, so a fact that
// spans two sentences is still whole in at least one piece. Short text is returned as is.
export function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  // Sentences, and lines without end punctuation, each become one unit
  const units = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((unit) => unit.trim())
    .filter(Boolean)
    // A single unit longer than a whole piece is cut into piece-sized parts
    .flatMap((unit) => {
      const parts: string[] = [];
      for (let start = 0; start < unit.length; start += maxChars) {
        parts.push(unit.slice(start, start + maxChars));
      }
      return parts;
    });

  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const unit of units) {
    if (current.length > 0 && length + 1 + unit.length > maxChars) {
      chunks.push(current.join(' '));
      // Carry the last sentence over, if it leaves room for the next one
      const last = current[current.length - 1];
      current = last.length + 1 + unit.length <= maxChars ? [last] : [];
      length = current.length > 0 ? last.length : 0;
    }
    length += (current.length > 0 ? 1 : 0) + unit.length;
    current.push(unit);
  }
  if (current.length > 0) chunks.push(current.join(' '));

  return chunks;
}
