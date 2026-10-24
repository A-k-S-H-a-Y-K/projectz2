import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import type { JWTPayload } from '../types/index.js';
import { JWT_ALGORITHM } from '../lib/auth.js';

declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verify(token, process.env.JWT_SECRET!, JWT_ALGORITHM);
    c.set('user', payload as unknown as JWTPayload);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
}; 