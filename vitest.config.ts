import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Tests never read .env: the database and AI services are mocked
    env: {
      JWT_SECRET: 'test-secret',
      // High enough that route tests aren't rate limited; limits have their own tests
      AUTH_ATTEMPTS_PER_15_MIN: '1000',
      AI_QUESTIONS_PER_HOUR: '1000',
      AI_QUESTIONS_PER_DAY: '1000',
    },
  },
});
