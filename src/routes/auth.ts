import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { User } from '@prisma/client';
import { signupSchema, loginSchema } from '../validations/index.js';
import { db } from '../lib/db.js';
import { hashPassword, comparePassword, generateToken } from '../lib/auth.js';
import { DEMO_EMAIL, isDemoEnabled, signupMode } from '../lib/demo.js';
import { clientIp, envNumber, rateLimit } from '../lib/rateLimit.js';
import type { AuthResponse } from '../types/index.js';
import { authMiddleware } from '../middleware/auth.js';

const auth = new Hono();

// Slows down password guessing and sign-up spam
const authAttemptLimit = rateLimit({
  limit: envNumber('AUTH_ATTEMPTS_PER_15_MIN', 10),
  windowMs: 15 * 60 * 1000,
  key: (c) => `auth:${clientIp(c)}`,
  message: 'Too many attempts. Please try again later.',
});

const buildAuthResponse = async (user: User, demo = false): Promise<AuthResponse> => ({
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  },
  token: await generateToken({ userId: user.id, email: user.email, ...(demo && { demo }) }),
  demo,
});

auth.post('/signup', authAttemptLimit, zValidator('json', signupSchema), async (c) => {
  const { email, name, password, inviteCode } = c.req.valid('json');

  const mode = signupMode();
  if (mode === 'closed') {
    return c.json({ error: 'Sign-up is closed. Try the demo instead.' }, 403);
  }
  if (mode === 'invite' && (!process.env.INVITE_CODE || inviteCode !== process.env.INVITE_CODE)) {
    return c.json({ error: 'A valid invite code is required to sign up' }, 403);
  }

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

auth.post('/login', authAttemptLimit, zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  return c.json(await buildAuthResponse(user));
});

// Logs into the shared, read-only demo account without a password
auth.post('/demo', authAttemptLimit, async (c) => {
  if (!isDemoEnabled()) {
    return c.json({ error: 'The demo is disabled' }, 404);
  }

  const user = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    return c.json({ error: 'The demo account has not been set up yet' }, 503);
  }

  return c.json(await buildAuthResponse(user, true));
});

// Tells a client which sign-up options to show
auth.get('/config', (c) => c.json({ signupMode: signupMode(), demoEnabled: isDemoEnabled() }));

auth.get('/session', authMiddleware, async (c) => {
  const { userId, demo } = c.get('user');

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

  return c.json({ user, demo: demo === true });
});

export default auth;
