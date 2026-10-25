import type { User, Memory } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

export interface JWTPayload {
  userId: number;
  email: string;
  iat: number;
  exp: number;
}

// A memory returned by semantic search, with its similarity to the query (0 to 1).
// `suspicious` memories look like prompt injections and are never shown to the model.
export type ScoredMemory = Memory & { score: number; suspicious: boolean };

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
}
