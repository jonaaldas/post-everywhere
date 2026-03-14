import { jwt } from 'hono/jwt';

import { env } from '../env.js';

export const jwtAuth = jwt({ secret: env.jwtSecret, alg: 'HS256' });
