import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';

vi.mock('../env.js', () => ({
  env: { jwtSecret: 'test-secret-key' },
}));

import { jwtAuth } from './auth.js';

function createApp() {
  const app = new Hono();
  app.use('/protected/*', jwtAuth);
  app.get('/protected/data', (c) => {
    const payload = c.get('jwtPayload');
    return c.json({ userId: payload.sub });
  });
  return app;
}

describe('middleware/auth — jwtAuth', () => {
  it('rejects requests without Authorization header', async () => {
    const app = createApp();
    const res = await app.request('/protected/data');
    expect(res.status).toBe(401);
  });

  it('rejects requests with invalid token', async () => {
    const app = createApp();
    const res = await app.request('/protected/data', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects requests with wrong secret', async () => {
    const token = await sign({ sub: 'u1' }, 'wrong-secret');
    const app = createApp();
    const res = await app.request('/protected/data', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it('allows requests with valid token and sets jwtPayload', async () => {
    const token = await sign({ sub: 'u1' }, 'test-secret-key');
    const app = createApp();
    const res = await app.request('/protected/data', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('u1');
  });
});
