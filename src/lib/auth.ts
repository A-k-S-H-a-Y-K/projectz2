import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';

const DEFAULT_TOKEN_LIFETIME = '7d';
const SECONDS_PER_UNIT: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

// Parses "604800", "30m", "12h" or "7d" into seconds
function parseDuration(value: string): number {
  const match = /^(\d+)([smhd]?)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid JWT_EXPIRES_IN value "${value}". Use seconds or a duration like "7d".`);
  }
  return Number(match[1]) * SECONDS_PER_UNIT[match[2] || 's'];
}

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 10);

export const comparePassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

export const generateToken = (payload: { userId: number; email: string }): Promise<string> => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const now = Math.floor(Date.now() / 1000);
  const lifetime = parseDuration(process.env.JWT_EXPIRES_IN || DEFAULT_TOKEN_LIFETIME);

  return sign({ ...payload, iat: now, exp: now + lifetime }, jwtSecret);
};
