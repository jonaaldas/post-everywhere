import 'dotenv/config';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

import app from './app.js';
import { env } from './env.js';

// On Node deployments, serve the built SPA from /public when it exists.
const webDistPath = resolve(import.meta.dirname, '../public');

if (existsSync(webDistPath)) {
  app.use('*', serveStatic({ root: webDistPath }));
  app.get('*', serveStatic({ root: webDistPath, path: '/index.html' }));
} else {
  app.get('/', (c) => c.text('Post Everywhere API'));
}

serve(
  {
    fetch: app.fetch,
    port: env.port || 8787,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  }
);
