import type { Context, MiddlewareHandler } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

// Fixed-window counter: each key may make `limit` requests per `windowMs`.
// Counts live in this process's memory, so they reset when the server restarts and
// aren't shared between instances. That's enough for a single small server; running
// several instances would need a shared store such as Redis.
export function createRateLimiter(limit: number, windowMs: number) {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return (key: string, now = Date.now()) => {
    // Drop expired windows now and then so the map can't grow forever
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k);
    }

    const window = windows.get(key);
    if (!window || now >= window.resetAt) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (window.count >= limit) {
      return { allowed: false, retryAfterMs: window.resetAt - now };
    }
    window.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  };
}

export function rateLimit(options: {
  limit: number;
  windowMs: number;
  key: (c: Context) => string;
  message: string;
}): MiddlewareHandler {
  const check = createRateLimiter(options.limit, options.windowMs);

  return async (c, next) => {
    const { allowed, retryAfterMs } = check(options.key(c));
    if (!allowed) {
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
      c.header('Retry-After', String(retryAfterSeconds));
      return c.json({ error: options.message, retryAfterSeconds }, 429);
    }
    await next();
  };
}

// The caller's IP address. Behind a hosting provider's proxy (TRUST_PROXY=true), the
// connecting address is the proxy, so the client's address is taken from X-Forwarded-For.
// Render puts the client's address first. The last entry, tried at first, turned out to be
// one of Render's own proxies, which changed between requests, so per-visitor limits never
// applied on the live site.
export function clientIp(c: Context): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    // No socket, e.g. requests made directly to the app in tests
    return 'unknown';
  }
}

export const envNumber = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
