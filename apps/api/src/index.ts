import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('/api/*', cors());

app.get('/api/status', (c) => {
  return c.json({
    name: 'post-everywhere-api',
    version: '0.1.0',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    routes: ['/api/status', '/api/channels'],
  });
});

app.get('/api/channels', (c) => {
  return c.json([
    { id: 'web', label: 'Web', reach: '18k readers', state: 'ready' },
    { id: 'email', label: 'Email', reach: '6.4k subscribers', state: 'staged' },
    { id: 'social', label: 'Social', reach: '42k followers', state: 'ready' },
  ]);
});

app.get('/', (c) => c.text('Post Everywhere API'));

const port = Number(process.env.PORT || 8787);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  }
);
