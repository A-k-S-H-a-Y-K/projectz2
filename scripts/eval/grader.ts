// The grader used by the answer evaluation: a second model call that checks an answer
// against the notes it was based on. `npm run eval:grader` checks the grader itself.
import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import type { Memory } from '@prisma/client';

export const GRADER_MODEL =
  process.env.GRADER_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-flash-lite-latest';

const grader = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Grade {
  answersQuestion: boolean;
  saysNotFound: boolean;
  unsupportedClaims: string[];
  wrongCitations: string[];
  timingErrors: string[];
}

const GRADER_INSTRUCTIONS = `You check answers written by a personal assistant. The assistant may only use facts from the user's notes, which are numbered. It cites a note after each fact as [n].

Check the answer against the notes and today's date, and report:
- answersQuestion: true if the answer gives the information asked for, as far as the notes contain it.
- saysNotFound: true if the answer says that the notes don't contain (some of) what was asked.
- unsupportedClaims: each statement about the user that the notes don't support, including invented or changed names, numbers and dates. Empty if there are none.
- wrongCitations: each citation [n] placed next to a statement that note n doesn't support. Also list any statement taken from a note that has no citation, and any citation next to a sentence saying something isn't in the notes. Empty if there are none.
- timingErrors: each place where the answer calls something upcoming, recent, past or done in a way that contradicts today's date or the notes. A planned event whose date has passed is not upcoming, and it hasn't necessarily happened. Empty if there are none.

Quote the exact words from the answer in each problem you list, and say briefly what is wrong. Be strict about facts, but don't count friendly wording, or a fact restated slightly differently, as a problem.`;

export type GradedNote = Pick<Memory, 'title' | 'content' | 'createdAt'>;

const formatNotes = (notes: GradedNote[]) =>
  notes
    .map(
      (m, i) =>
        `[${i + 1}] ${m.title ?? 'Untitled'} (saved ${m.createdAt.toISOString().slice(0, 10)})\n${m.content}`
    )
    .join('\n\n') || '(no notes)';

export async function grade(question: string, notes: GradedNote[], answer: string): Promise<Grade> {
  const response = await grader.models.generateContent({
    model: GRADER_MODEL,
    contents: `Today's date: ${new Date().toISOString().slice(0, 10)}

Notes:
${formatNotes(notes)}

Question: ${question}

Answer to check:
${answer}`,
    config: {
      systemInstruction: GRADER_INSTRUCTIONS,
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answersQuestion: { type: Type.BOOLEAN },
          saysNotFound: { type: Type.BOOLEAN },
          unsupportedClaims: { type: Type.ARRAY, items: { type: Type.STRING } },
          wrongCitations: { type: Type.ARRAY, items: { type: Type.STRING } },
          timingErrors: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'answersQuestion',
          'saysNotFound',
          'unsupportedClaims',
          'wrongCitations',
          'timingErrors',
        ],
      },
    },
  });
  return JSON.parse(response.text ?? '{}') as Grade;
}
