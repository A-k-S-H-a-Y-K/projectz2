import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Tests never read .env: the database and AI services are mocked
    env: { JWT_SECRET: 'test-secret' },
  },
});
