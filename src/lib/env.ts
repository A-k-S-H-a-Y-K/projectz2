// Checks the settings the server can't run without, so a bad deploy fails at startup with a
// clear message instead of on the first request that needs the missing value.

const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PINECONE_API_KEY',
  'PINECONE_INDEX_NAME',
  'GEMINI_API_KEY',
] as const;

// HS256 keys shorter than the hash output (32 bytes) are easier to brute-force
const MIN_PRODUCTION_SECRET_LENGTH = 32;

// Returns one message per problem; an empty list means the settings are usable
export function checkEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const problems = REQUIRED.filter((name) => !env[name]?.trim()).map(
    (name) => `${name} is not set`
  );

  if (env.SIGNUP_MODE === 'invite' && !env.INVITE_CODE?.trim()) {
    problems.push('INVITE_CODE is not set, but SIGNUP_MODE is "invite"');
  }

  if (env.NODE_ENV === 'production') {
    // Without it the API would only accept requests from http://localhost:3000
    if (!env.CORS_ORIGIN?.trim()) {
      problems.push('CORS_ORIGIN must be set to the frontend URL in production');
    }
    if (env.JWT_SECRET && env.JWT_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
      problems.push(
        `JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`
      );
    }
  }

  return problems;
}
