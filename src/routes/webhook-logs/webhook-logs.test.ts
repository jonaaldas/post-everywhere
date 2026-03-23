import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../env.js', () => ({
  env: { jwtSecret: 'test-secret-key' },
}));

const mockListWebhookLogs = vi.fn();

vi.mock('../../db/webhook-logs/webhook-logs.js', () => ({
  listWebhookLogs: (...args: unknown[]) => mockListWebhookLogs(...args),
}));

import { webhookLogsRoute } from './webhook-logs.js';

function createApp() {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('jwtPayload', { sub: 'u1' });
    await next();
  });
  app.route('/api/webhook-logs', webhookLogsRoute);
  return app;
}

describe('GET /api/webhook-logs', () => {
  beforeEach(() => {
    mockListWebhookLogs.mockReset();
  });

  it('returns logs with default limit', async () => {
    const logs = [{ id: 'wl1', eventType: 'push', source: 'github', statusCode: 200 }];
    mockListWebhookLogs.mockResolvedValue(logs);

    const app = createApp();
    const res = await app.request('/api/webhook-logs');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(logs);
    expect(mockListWebhookLogs).toHaveBeenCalledWith(100);
  });

  it('accepts custom limit', async () => {
    mockListWebhookLogs.mockResolvedValue([]);

    const app = createApp();
    const res = await app.request('/api/webhook-logs?limit=50');

    expect(res.status).toBe(200);
    expect(mockListWebhookLogs).toHaveBeenCalledWith(50);
  });

  it('caps limit at 500', async () => {
    mockListWebhookLogs.mockResolvedValue([]);

    const app = createApp();
    const res = await app.request('/api/webhook-logs?limit=9999');

    expect(res.status).toBe(200);
    expect(mockListWebhookLogs).toHaveBeenCalledWith(500);
  });
});
