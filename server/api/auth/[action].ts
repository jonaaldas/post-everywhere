import bcrypt from 'bcryptjs';

import { countUsers, createUser, findByEmail } from '../../../src/db/users/users.js';
import { clearAuthCookie, requireUser, setAuthCookie, signJwt } from '../../utils/auth.js';
import { jsonError } from '../../utils/http.js';

export default defineEventHandler(async (event) => {
  const action = getRouterParam(event, 'action');

  if (action === 'me' && event.method === 'GET') {
    const payload = requireUser(event);
    return { user: { id: payload.sub, email: payload.email } };
  }

  if (action === 'logout' && event.method === 'POST') {
    clearAuthCookie(event);
    return { ok: true };
  }

  if (event.method !== 'POST') {
    return jsonError(event, 404, 'not found');
  }

  const body = await readBody<{ email?: string; password?: string }>(event);

  if (!body?.email || !body?.password) {
    return jsonError(event, 400, 'email and password are required');
  }

  if (action === 'register') {
    if (body.password.length < 8) {
      return jsonError(event, 400, 'password must be at least 8 characters');
    }

    const existing = await countUsers();
    if (existing > 0) {
      return jsonError(event, 403, 'registration is closed (single-user app)');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await createUser(crypto.randomUUID(), body.email, passwordHash);
    const token = signJwt({ sub: user.id, email: user.email });
    setAuthCookie(event, token);

    return { user: { id: user.id, email: user.email } };
  }

  if (action === 'login') {
    const user = await findByEmail(body.email);
    if (!user) {
      return jsonError(event, 401, 'invalid credentials');
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return jsonError(event, 401, 'invalid credentials');
    }

    const token = signJwt({ sub: user.id, email: user.email });
    setAuthCookie(event, token);

    return { user: { id: user.id, email: user.email } };
  }

  return jsonError(event, 404, 'not found');
});
