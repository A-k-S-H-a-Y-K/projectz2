// Which questions an evaluation runs on: the tuning questions in dataset.ts (the default), or
// the held-out test set in test-set.ts with --test. Each set writes its own reports.
import { questions as tuningQuestions, type EvalQuestion } from './dataset.js';
import { testQuestions, type TestQuestion } from './test-set.js';

// npm scripts pass --test, since setting an environment variable inline doesn't work on Windows
export const isTestSet = process.argv.includes('--test') || process.env.EVAL_SET === 'test';

export type SetQuestion = EvalQuestion & Partial<Pick<TestQuestion, 'source' | 'overlapsTuning'>>;

export const evalQuestions: SetQuestion[] = isTestSet ? testQuestions : tuningQuestions;

export const setLabel = isTestSet ? 'held-out test set' : 'tuning set';

// results.md for the tuning set, results-test.md for the test set
export const reportFile = (name: string) => (isTestSet ? `${name}-test.md` : `${name}.md`);

// Groups of test questions reported separately. The first is the headline: written in casual
// user style and // not overlapping any tuning question.
export const testGroups: [string, (q: SetQuestion) => boolean][] = [
  ['Casual style, not overlapping (headline)', (q) => q.source === 'casual' && !q.overlapsTuning],
  ['Casual style, overlapping a tuning question', (q) => q.source === 'casual' && !!q.overlapsTuning],
  ['Informed', (q) => q.source === 'informed'],
  ['All test questions', () => true],
];

// Nearest-rank percentile, e.g. percentile(times, 95)
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
