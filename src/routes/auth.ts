import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { signupSchema, loginSchema } from '../validations/index.js';
import { db, hashPassword, comparePassword, generateToken } from '../lib/db.js';
import type { AuthResponse } from '../types/index.js';
import { authMiddleware } from '../middleware/auth.js';

const auth = new Hono();

auth.post('/signup', zValidator('json', signupSchema), async (c) => {
  const { email, name, password } = c.req.valid('json');

  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return c.json({ error: 'Email already registered' }, 400);
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash,
    },
  });

  const token = await generateToken({ userId: user.id, email: user.email });
  const response: AuthResponse = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    token,
  };

  return c.json(response, 201);
});

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const isValidPassword = await comparePassword(password, user.passwordHash);
  if (!isValidPassword) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await generateToken({ userId: user.id, email: user.email });
  const response: AuthResponse = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    token,
  };

  return c.json(response);
});

// Apply authMiddleware only to /session
auth.use('/session', authMiddleware);

auth.get('/session', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user || typeof user.userId === 'undefined') {
      return c.json({ error: 'Invalid user context' }, 401);
    }

    // Ensure userId is a number
    const userId = Number(user.userId);
    if (isNaN(userId) || userId <= 0) {
      return c.json({ error: 'Invalid user ID format' }, 401);
    }

    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ user: dbUser });
  } catch (error) {
    console.error('Session error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default auth; 