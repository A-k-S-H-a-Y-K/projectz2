import type { User, Memory } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

export interface JWTPayload {
  userId: number;
  email: string;
  // True for the shared, read-only demo account
  demo?: boolean;
  iat: number;
  exp: number;
}

export type SearchSource = 'semantic' | 'keyword';
// 'rerank' is hybrid search followed by the reranker
export type SearchMode = SearchSource | 'hybrid' | 'rerank';

// A memory returned by search. `score` is its similarity to the query (0 to 1), or null if
// only keyword search found it. `rerankScore` is the reranker's relevance score (0 to 1), or
// null when reranking is off or failed. `strongMatch` means it matched in meaning and also
// contains every word of the question. `matchedBy` lists the searches that found it.
// `suspicious` memories look like prompt injections and are never shown to the model.
export type ScoredMemory = Memory & {
  score: number | null;
  rerankScore: number | null;
  strongMatch: boolean;
  matchedBy: SearchSource[];
  suspicious: boolean;
};

// A memory shown alongside an answer. `citation` is its [n] label in the answer
// (null for suspicious memories, which the model never saw), and `cited` says
// whether the answer actually referred to it.
export type Reference = ScoredMemory & { citation: number | null; cited: boolean };

export interface SearchResponse {
  answer: string;
  references: Reference[];
  // The question actually searched for: a follow-up rewritten to stand on its own, or the
  // question as asked
  searchedFor: string;
}

// One earlier question and its answer, sent with a follow-up question
export interface ConversationTurn {
  question: string;
  answer: string;
}

export interface AuthResponse {
  user: SafeUser;
  token: string;
  demo: boolean;
}
