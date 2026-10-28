import { describe, expect, it } from 'vitest';
import { checkEnv } from '../../src/lib/env.js';

const valid = {
  DATABASE_URL: 'postgresql://localhost/test',
  JWT_SECRET: 'a'.repeat(32),
  PINECONE_API_KEY: 'pinecone-key',
  PINECONE_INDEX_NAME: 'memories',
  GEMINI_API_KEY: 'gemini-key',
};

describe('checkEnv', () => {
  it('accepts a complete development setup', () => {
    expect(checkEnv(valid)).toEqual([]);
  });

  it('names every missing or blank required setting', () => {
    expect(checkEnv({ ...valid, DATABASE_URL: undefined, GEMINI_API_KEY: '  ' })).toEqual([
      'DATABASE_URL is not set',
      'GEMINI_API_KEY is not set',
    ]);
  });

  it('requires an invite code in invite mode', () => {
    expect(checkEnv({ ...valid, SIGNUP_MODE: 'invite' })).toEqual([
      'INVITE_CODE is not set, but SIGNUP_MODE is "invite"',
    ]);
    expect(checkEnv({ ...valid, SIGNUP_MODE: 'invite', INVITE_CODE: 'secret' })).toEqual([]);
  });

  it('requires CORS_ORIGIN and a long JWT secret in production', () => {
    const problems = checkEnv({ ...valid, NODE_ENV: 'production', JWT_SECRET: 'short' });
    expect(problems).toEqual([
      'CORS_ORIGIN must be set to the frontend URL in production',
      'JWT_SECRET must be at least 32 characters in production',
    ]);
  });

  it('accepts a complete production setup', () => {
    expect(
      checkEnv({ ...valid, NODE_ENV: 'production', CORS_ORIGIN: 'https://example.com' })
    ).toEqual([]);
  });
});
