import { afterEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { clientIp, createRateLimiter, rateLimit } from '../../src/lib/rateLimit.js';

describe('createRateLimiter', () => {
  it('allows up to the limit, then blocks until the window ends', () => {
    const check = createRateLimiter(2, 60_000);

    expect(check('a', 0).allowed).toBe(true);
    expect(check('a', 1_000).allowed).toBe(true);
    expect(check('a', 2_000)).toEqual({ allowed: false, retryAfterMs: 58_000 });
    expect(check('a', 60_000).allowed).toBe(true);
  });

  it('counts each key separately', () => {
    const check = createRateLimiter(1, 60_000);

    expect(check('a', 0).allowed).toBe(true);
    expect(check('b', 0).allowed).toBe(true);
    expect(check('a', 0).allowed).toBe(false);
  });
});

describe('rateLimit middleware', () => {
  it('responds 429 with Retry-After once the limit is reached', async () => {
    const app = new Hono();
    app.use(rateLimit({ limit: 2, windowMs: 60_000, key: () => 'all', message: 'Slow down' }));
    app.get('/', (c) => c.text('ok'));

    expect((await app.request('/')).status).toBe(200);
    expect((await app.request('/')).status).toBe(200);

    const blocked = await app.request('/');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('60');
    expect(await blocked.json()).toEqual({ error: 'Slow down', retryAfterSeconds: 60 });
  });
});

describe('clientIp', () => {
  const app = new Hono().get('/', (c) => c.text(clientIp(c)));
  const ipFor = async (headers: Record<string, string>) => (await app.request('/', { headers })).text();

  afterEach(() => {
    delete process.env.TRUST_PROXY;
  });

  it("uses the first X-Forwarded-For entry behind a proxy, where Render puts the client's address", async () => {
    process.env.TRUST_PROXY = 'true';

    expect(await ipFor({ 'X-Forwarded-For': '203.0.113.7, 10.0.0.1, 10.0.0.2' })).toBe('203.0.113.7');
  });

  it('ignores X-Forwarded-For unless the proxy is trusted', async () => {
    expect(await ipFor({ 'X-Forwarded-For': '203.0.113.7' })).toBe('unknown');
  });
});
