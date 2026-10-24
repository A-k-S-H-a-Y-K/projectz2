import type { User, Memory } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

export interface JWTPayload {
  userId: number;
  email: string;
  iat: number;
  exp: number;
}

export interface SearchResponse {
  answer: string;
  references: Memory[];
}

export interface AuthResponse {
  user: SafeUser;
  token: string;
}
