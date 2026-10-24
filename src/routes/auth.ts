import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { User } from '@prisma/client';
import { signupSchema, loginSchema } from '../validations/index.js';
import { db } from '../lib/db.js';
import { hashPassword, comparePassword, generateToken } from '../lib/auth.js';
import type { AuthResponse } from '../types/index.js';
import { authMiddleware } from '../middleware/auth.js';

const auth = new Hono();

const buildAuthResponse = async (user: User): Promise<AuthResponse> => ({
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  },
  token: await generateToken({ userId: user.id, email: user.email }),
});

auth.post('/signup', zValidator('json', signupSchema), async (c) => {
  const { email, name, password } = c.req.valid('json');

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return c.json({ error: 'Email already registered' }, 400);
  }

  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
    },
  });

  return c.json(await buildAuthResponse(user), 201);
});

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  return c.json(await buildAuthResponse(user));
});

auth.get('/session', authMiddleware, async (c) => {
  const { userId } = c.get('user');

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

export default auth;
