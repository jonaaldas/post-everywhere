import 'dotenv/config';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { listChannels } from './db/channels/channels.js';
import { pingDatabase } from './db/client/client.js';
import { env } from './env.js';
import { cookieToAuth, jwtAuth } from './middleware/auth/auth.js';
import { auth } from './routes/auth/auth.js';
import { github } from './routes/github/github.js';
import { webhooks } from './routes/webhooks/webhooks.js';
import { posts as postsRoutes } from './routes/posts/posts.js';
import { social, socialCallback } from './routes/social/social.js';
import { media } from './routes/media/media.js';
import { webhookLogsRoute } from './routes/webhook-logs/webhook-logs.js';

const app = new Hono();

app.use('/api/*', cors());

// Public routes (no auth)
app.route('/api/auth', auth);
app.route('/api/webhooks', webhooks);
app.route('/api/social', socialCallback); // OAuth callbacks (public, no JWT)

app.get('/api/status', async (c) => {
  const database = await pingDatabase();

  return c.json({
    name: 'Post Everywhere API',
    version: '0.3.0',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    routes: ['/api/status', '/api/channels', '/api/auth/register', '/api/auth/login', '/api/webhook-logs', '/api/media/upload'],
    database,
  });
});

// Protected routes — everything below requires JWT
app.use('/api/*', cookieToAuth);
app.use('/api/*', jwtAuth);

app.get('/api/auth/me', (c) => {
  const payload = c.get('jwtPayload') as { sub: string; email: string };
  return c.json({ user: { id: payload.sub, email: payload.email } });
});

app.route('/api/github', github);
app.route('/api/posts', postsRoutes);
app.route('/api/social', social); // Protected social routes (JWT required)
app.route('/api/media', media);
app.route('/api/webhook-logs', webhookLogsRoute);

app.get('/api/channels', async (c) => {
  try {
    return c.json(await listChannels());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';

    return c.json(
      {
        error: 'DatabaseUnavailable',
        message,
      },
      503
    );
  }
});

// In production, serve the Vue SPA static files
const webDistPath = resolve(import.meta.dirname, '../../../apps/web/dist');

if (existsSync(webDistPath)) {
  app.use('*', serveStatic({ root: webDistPath }));
  // SPA fallback — serve index.html for client-side routing
  app.get('*', serveStatic({ root: webDistPath, path: '/index.html' }));
} else {
  app.get('/', (c) => c.text('Post Everywhere API'));
}

const port = env.port || 8787;

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  }
);
