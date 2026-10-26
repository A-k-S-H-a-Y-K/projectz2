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
export type SearchMode = SearchSource | 'hybrid';

// A memory returned by hybrid search. `score` is its similarity to the query (0 to 1),
// or null if only keyword search found it. `matchedBy` lists the searches that found it.
// `suspicious` memories look like prompt injections and are never shown to the model.
export type ScoredMemory = Memory & {
  score: number | null;
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
}

export interface AuthResponse {
  user: SafeUser;
  token: string;
  demo: boolean;
}
