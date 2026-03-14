import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import bcrypt from 'bcryptjs';

import { env } from '../../env.js';
import { countUsers, createUser, findByEmail } from '../../db/users/users.js';

const auth = new Hono();

auth.post('/register', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: 'email and password are required' }, 400);
  }

  if (body.password.length < 8) {
    return c.json({ error: 'password must be at least 8 characters' }, 400);
  }

  const existing = await countUsers();
  if (existing > 0) {
    return c.json({ error: 'registration is closed (single-user app)' }, 403);
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const id = crypto.randomUUID();
  const user = await createUser(id, body.email, passwordHash);

  const token = await sign({ sub: user.id, email: user.email }, env.jwtSecret);

  return c.json({ token, user: { id: user.id, email: user.email } }, 201);
});

auth.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: 'email and password are required' }, 400);
  }

  const user = await findByEmail(body.email);
  if (!user) {
    return c.json({ error: 'invalid credentials' }, 401);
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'invalid credentials' }, 401);
  }

  const token = await sign({ sub: user.id, email: user.email }, env.jwtSecret);

  return c.json({ token, user: { id: user.id, email: user.email } });
});

export { auth };
