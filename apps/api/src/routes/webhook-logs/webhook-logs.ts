import { Hono } from 'hono';

import { listWebhookLogs } from '../../db/webhook-logs/webhook-logs.js';

const webhookLogsRoute = new Hono();

webhookLogsRoute.get('/', async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? Math.min(Number(limitParam), 500) : 100;

  const logs = await listWebhookLogs(limit);
  return c.json(logs);
});

export { webhookLogsRoute };
