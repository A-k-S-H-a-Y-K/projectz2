import type { User, Memory } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

export interface JWTPayload {
  userId: number;
  email: string;
  iat: number;
  exp: number;
}

// A memory returned by semantic search, with its similarity to the query (0 to 1)
export type ScoredMemory = Memory & { score: number };

// A memory shown alongside an answer. `citation` is its [n] label in the answer,
// and `cited` says whether the answer actually referred to it.
export type Reference = ScoredMemory & { citation: number; cited: boolean };

export interface SearchResponse {
  answer: string;
  references: Reference[];
}

export interface AuthResponse {
  user: SafeUser;
  token: string;
}
