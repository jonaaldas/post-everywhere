import 'dotenv/config';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { listChannels } from './db/channels/channels.js';
import { pingDatabase } from './db/client/client.js';
import { env } from './env.js';
import { jwtAuth } from './middleware/auth/auth.js';
import { auth } from './routes/auth/auth.js';
import { github } from './routes/github/github.js';
import { webhooks } from './routes/webhooks/webhooks.js';
import { posts as postsRoutes } from './routes/posts/posts.js';

const app = new Hono();

app.use('/api/*', cors());

// Public routes (no auth)
app.route('/api/auth', auth);
app.route('/api/webhooks', webhooks);

app.get('/api/status', async (c) => {
  const database = await pingDatabase();

  return c.json({
    name: 'post-everywhere-api',
    version: '0.1.0',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    routes: ['/api/status', '/api/channels', '/api/auth/register', '/api/auth/login'],
    database,
  });
});

// Protected routes — everything below requires JWT
app.use('/api/*', jwtAuth);

app.route('/api/github', github);
app.route('/api/posts', postsRoutes);

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

app.get('/', (c) => c.text('Post Everywhere API'));

const port = env.port;

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  }
);
