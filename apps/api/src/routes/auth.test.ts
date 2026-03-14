import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock env
vi.mock('../env.js', () => ({
  env: { jwtSecret: 'test-secret-key' },
}));

// Mock db/users
const mockCountUsers = vi.fn();
const mockCreateUser = vi.fn();
const mockFindByEmail = vi.fn();

vi.mock('../db/users.js', () => ({
  countUsers: (...args: unknown[]) => mockCountUsers(...args),
  createUser: (...args: unknown[]) => mockCreateUser(...args),
  findByEmail: (...args: unknown[]) => mockFindByEmail(...args),
}));

import { auth } from './auth.js';

function createApp() {
  const app = new Hono();
  app.route('/api/auth', auth);
  return app;
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when email is missing', async () => {
    const app = createApp();
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'longpassword' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'email and password are required' });
  });

  it('returns 400 when password is missing', async () => {
    const app = createApp();
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const app = createApp();
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com', password: 'short' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'password must be at least 8 characters' });
  });

  it('returns 403 when a user already exists', async () => {
    mockCountUsers.mockResolvedValue(1);
    const app = createApp();
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com', password: 'longpassword' }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'registration is closed (single-user app)' });
  });

  it('registers first user and returns JWT', async () => {
    mockCountUsers.mockResolvedValue(0);
    mockCreateUser.mockResolvedValue({ id: 'user-1', email: 'user@test.com' });

    const app = createApp();
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com', password: 'longpassword' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('user@test.com');
    expect(mockCreateUser).toHaveBeenCalledOnce();
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when email is missing', async () => {
    const app = createApp();
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'longpassword' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 for non-existent user', async () => {
    mockFindByEmail.mockResolvedValue(undefined);
    const app = createApp();
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@test.com', password: 'longpassword' }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid credentials' });
  });

  it('returns 401 for wrong password', async () => {
    // bcrypt hash of "correctpassword"
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correctpassword', 10);
    mockFindByEmail.mockResolvedValue({ id: 'user-1', email: 'user@test.com', passwordHash: hash });

    const app = createApp();
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com', password: 'wrongpassword' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns JWT for valid credentials', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correctpassword', 10);
    mockFindByEmail.mockResolvedValue({ id: 'user-1', email: 'user@test.com', passwordHash: hash });

    const app = createApp();
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com', password: 'correctpassword' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('user@test.com');
  });
});
