import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock env
vi.mock('../../env.js', () => ({
  env: {
    jwtSecret: 'test-secret-key',
    encryptionKey: 'a'.repeat(64),
    githubWebhookSecret: 'whsec_test',
    appBaseUrl: 'https://test.example.com',
  },
}));

// Mock crypto lib
const mockEncrypt = vi.fn().mockReturnValue('encrypted-pat');
const mockDecrypt = vi.fn().mockReturnValue('ghp_decrypted_token');

vi.mock('../../lib/crypto/crypto.js', () => ({
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

// Mock github lib
const mockVerifyPat = vi.fn();
const mockListUserRepos = vi.fn();
const mockCreateWebhook = vi.fn();
const mockDeleteWebhook = vi.fn();

vi.mock('../../lib/github/github.js', () => ({
  verifyPat: (...args: unknown[]) => mockVerifyPat(...args),
  listUserRepos: (...args: unknown[]) => mockListUserRepos(...args),
  createWebhook: (...args: unknown[]) => mockCreateWebhook(...args),
  deleteWebhook: (...args: unknown[]) => mockDeleteWebhook(...args),
}));

// Mock db/github
const mockSaveConnection = vi.fn();
const mockGetConnection = vi.fn();
const mockAddWatchedRepo = vi.fn();
const mockGetWatchedRepo = vi.fn();
const mockRemoveWatchedRepo = vi.fn();
const mockListWatchedRepos = vi.fn();

vi.mock('../../db/github/github.js', () => ({
  saveConnection: (...args: unknown[]) => mockSaveConnection(...args),
  getConnection: (...args: unknown[]) => mockGetConnection(...args),
  addWatchedRepo: (...args: unknown[]) => mockAddWatchedRepo(...args),
  getWatchedRepo: (...args: unknown[]) => mockGetWatchedRepo(...args),
  removeWatchedRepo: (...args: unknown[]) => mockRemoveWatchedRepo(...args),
  listWatchedRepos: (...args: unknown[]) => mockListWatchedRepos(...args),
}));

import { github } from './github.js';

// Helper: create app with fake JWT payload injected as middleware
function createApp(userId = 'user-1') {
  const app = new Hono();
  // Simulate JWT middleware by setting jwtPayload
  app.use('/*', async (c, next) => {
    c.set('jwtPayload', { sub: userId });
    await next();
  });
  app.route('/api/github', github);
  return app;
}

describe('POST /api/github/connect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when pat is missing', async () => {
    const app = createApp();
    const res = await app.request('/api/github/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'pat is required' });
  });

  it('returns 401 when PAT is invalid', async () => {
    mockVerifyPat.mockRejectedValue(new Error('Bad credentials'));
    const app = createApp();
    const res = await app.request('/api/github/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pat: 'ghp_invalid' }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid GitHub PAT' });
  });

  it('connects successfully with valid PAT', async () => {
    mockVerifyPat.mockResolvedValue({ login: 'octocat' });
    mockSaveConnection.mockResolvedValue({});

    const app = createApp();
    const res = await app.request('/api/github/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pat: 'ghp_valid_token' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: true, githubUsername: 'octocat' });
    expect(mockEncrypt).toHaveBeenCalledWith('ghp_valid_token');
    expect(mockSaveConnection).toHaveBeenCalledOnce();
  });
});

describe('GET /api/github/repos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when not connected', async () => {
    mockGetConnection.mockResolvedValue(undefined);
    const app = createApp();
    const res = await app.request('/api/github/repos');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'GitHub not connected' });
  });

  it('lists repos with watched flag', async () => {
    mockGetConnection.mockResolvedValue({ personalAccessToken: 'encrypted' });
    mockListUserRepos.mockResolvedValue([
      { fullName: 'user/repo-a', name: 'repo-a', private: false, description: null, updatedAt: null },
      { fullName: 'user/repo-b', name: 'repo-b', private: true, description: 'B', updatedAt: null },
    ]);
    mockListWatchedRepos.mockResolvedValue([{ repoFullName: 'user/repo-a' }]);

    const app = createApp();
    const res = await app.request('/api/github/repos');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].watched).toBe(true);
    expect(body[1].watched).toBe(false);
  });
});

describe('POST /api/github/repos/:owner/:repo/watch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when not connected', async () => {
    mockGetConnection.mockResolvedValue(undefined);
    const app = createApp();
    const res = await app.request('/api/github/repos/user/repo/watch', { method: 'POST' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when already watching', async () => {
    mockGetConnection.mockResolvedValue({ personalAccessToken: 'encrypted' });
    mockGetWatchedRepo.mockResolvedValue({ id: 'existing' });

    const app = createApp();
    const res = await app.request('/api/github/repos/user/repo/watch', { method: 'POST' });
    expect(res.status).toBe(409);
  });

  it('creates webhook and returns 201', async () => {
    mockGetConnection.mockResolvedValue({ personalAccessToken: 'encrypted' });
    mockGetWatchedRepo.mockResolvedValue(undefined);
    mockCreateWebhook.mockResolvedValue({ webhookId: 'wh-123' });
    mockAddWatchedRepo.mockResolvedValue({
      id: 'wr-1',
      userId: 'user-1',
      repoFullName: 'user/repo',
      webhookId: 'wh-123',
      active: 1,
    });

    const app = createApp();
    const res = await app.request('/api/github/repos/user/repo/watch', { method: 'POST' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.repoFullName).toBe('user/repo');
    expect(mockCreateWebhook).toHaveBeenCalledWith('ghp_decrypted_token', 'user', 'repo');
  });
});

describe('DELETE /api/github/repos/:owner/:repo/watch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when not watching', async () => {
    mockGetConnection.mockResolvedValue({ personalAccessToken: 'encrypted' });
    mockGetWatchedRepo.mockResolvedValue(undefined);

    const app = createApp();
    const res = await app.request('/api/github/repos/user/repo/watch', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('deletes webhook and returns success', async () => {
    mockGetConnection.mockResolvedValue({ personalAccessToken: 'encrypted' });
    mockGetWatchedRepo.mockResolvedValue({ webhookId: 'wh-123', repoFullName: 'user/repo' });
    mockDeleteWebhook.mockResolvedValue(undefined);
    mockRemoveWatchedRepo.mockResolvedValue(undefined);

    const app = createApp();
    const res = await app.request('/api/github/repos/user/repo/watch', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: true });
    expect(mockDeleteWebhook).toHaveBeenCalledWith('ghp_decrypted_token', 'user', 'repo', 'wh-123');
    expect(mockRemoveWatchedRepo).toHaveBeenCalledWith('user-1', 'user/repo');
  });
});
