import { afterEach, describe, expect, it } from 'vitest';
import { verify } from 'hono/jwt';
import {
  comparePassword,
  generateToken,
  hashPassword,
  JWT_ALGORITHM,
  parseDuration,
} from '../../src/lib/auth.js';

describe('parseDuration', () => {
  it.each([
    ['604800', 604800],
    ['30m', 1800],
    ['12h', 43200],
    ['7d', 604800],
  ])('parses %j as %i seconds', (value, seconds) => {
    expect(parseDuration(value)).toBe(seconds);
  });

  it('rejects values it cannot parse', () => {
    expect(() => parseDuration('7 days')).toThrow(/JWT_EXPIRES_IN/);
  });
});

describe('generateToken', () => {
  afterEach(() => {
    delete process.env.JWT_EXPIRES_IN;
  });

  it('creates a token the auth middleware can verify', async () => {
    const token = await generateToken({ userId: 7, email: 'a@example.com' });
    const payload = await verify(token, process.env.JWT_SECRET!, JWT_ALGORITHM);
    expect(payload).toMatchObject({ userId: 7, email: 'a@example.com' });
  });

  it('defaults to a 7 day lifetime', async () => {
    const token = await generateToken({ userId: 1, email: 'a@example.com' });
    const { iat, exp } = await verify(token, process.env.JWT_SECRET!, JWT_ALGORITHM);
    expect(exp! - (iat as number)).toBe(7 * 24 * 60 * 60);
  });

  // Regression test: "7d" used to be parsed as 7 seconds
  it('uses JWT_EXPIRES_IN durations', async () => {
    process.env.JWT_EXPIRES_IN = '12h';
    const token = await generateToken({ userId: 1, email: 'a@example.com' });
    const { iat, exp } = await verify(token, process.env.JWT_SECRET!, JWT_ALGORITHM);
    expect(exp! - (iat as number)).toBe(12 * 60 * 60);
  });

  it('rejects tokens signed with a different secret', async () => {
    const token = await generateToken({ userId: 1, email: 'a@example.com' });
    await expect(verify(token, 'another-secret', JWT_ALGORITHM)).rejects.toThrow();
  });
});

describe('password hashing', () => {
  it('accepts the right password and rejects others', async () => {
    const hash = await hashPassword('correct horse');
    expect(await comparePassword('correct horse', hash)).toBe(true);
    expect(await comparePassword('wrong horse', hash)).toBe(false);
  });
});
