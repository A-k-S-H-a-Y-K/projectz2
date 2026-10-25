// Heuristic check for text that tries to give the LLM new instructions.
// This is a second line of defence: the main one is the prompt structure in
// services/ai.ts, which treats memory text as data. Phrase lists can't catch
// everything, so a clean result doesn't mean the text is safe.
const INJECTION_PATTERNS: RegExp[] = [
  // "ignore all previous instructions", "disregard the rules above"
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(instructions?|prompts?|rules|directions)\b/i,
  // "you are now DAN", "from now on you will..."
  /\b(you are now|from now on,? you|pretend (to be|you are))\b/i,
  // asking for or claiming to be hidden instructions
  /\b(system prompt|system message|developer message|hidden instructions?)\b/i,
  /\b(new|updated|real|actual) instructions?\s*:/i,
  // fake tags that try to close the <memory> block or open a system one
  /<\/?\s*(memory|system|instructions?|prompt)\b[^>]*>/i,
];

export function looksLikePromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

// Stops stored text from opening or closing tags inside the prompt
export function escapeForPrompt(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
