import { Prisma } from '@prisma/client';
import type { User, Memory } from '@prisma/client';

// Get the types from Prisma
export type SafeUser = Omit<User, 'passwordHash'>;

export interface JWTPayload {
  userId: number;
  email: string;
  iat: number;
  exp: number;
}

export interface CreateMemoryInput {
  title?: string | null;
  content: string;
  tags: string[];
}

export interface UpdateMemoryInput extends Partial<CreateMemoryInput> {}

export interface SearchResponse {
  answer: string;
  references: Memory[];
}

export type AuthResponse = {
  user: SafeUser;
  token: string;
};

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface MemoryFilters {
  tags?: string[];
  search?: string;
  startDate?: string; // ISO string date
  endDate?: string; // ISO string date
}

// Prisma query types
export type MemoryWhereInput = Prisma.MemoryWhereInput;
export type MemoryOrderByInput = Prisma.MemoryOrderByWithRelationInput;
export type MemoryIncludeInput = Prisma.MemoryInclude;

export {}; 