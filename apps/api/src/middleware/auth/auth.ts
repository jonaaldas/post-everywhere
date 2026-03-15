import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { jwt } from 'hono/jwt';

import { env } from '../../env.js';

/**
 * Copies pe_token cookie into Authorization header so the jwt() middleware can read it.
 * Requests that already have an Authorization header are left unchanged.
 */
export const cookieToAuth: MiddlewareHandler = async (c, next) => {
  if (!c.req.header('Authorization')) {
    const token = getCookie(c, 'pe_token');
    if (token) {
      c.req.raw.headers.set('Authorization', `Bearer ${token}`);
    }
  }
  await next();
};

export const jwtAuth = jwt({ secret: env.jwtSecret, alg: 'HS256' });
