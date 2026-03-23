import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../env.js', () => ({
  env: {
    jwtSecret: 'test-secret-key',
    appBaseUrl: 'http://localhost:5173',
    encryptionKey: '0'.repeat(64),
    twitterClientId: 'tw-client-id',
    twitterClientSecret: 'tw-client-secret',
    linkedinClientId: 'li-client-id',
    linkedinClientSecret: 'li-client-secret',
  },
}));

const mockGetSocialConnection = vi.fn();
const mockSaveSocialConnection = vi.fn();
const mockDeleteSocialConnection = vi.fn();

vi.mock('../../db/social/social.js', () => ({
  getSocialConnection: (...args: unknown[]) => mockGetSocialConnection(...args),
  saveSocialConnection: (...args: unknown[]) => mockSaveSocialConnection(...args),
  deleteSocialConnection: (...args: unknown[]) => mockDeleteSocialConnection(...args),
}));

const mockEncrypt = vi.fn((v: string) => `enc:${v}`);
const mockDecrypt = vi.fn((v: string) => v.replace('enc:', ''));

vi.mock('../../lib/crypto/crypto.js', () => ({
  encrypt: (v: string) => mockEncrypt(v),
  decrypt: (v: string) => mockDecrypt(v),
}));

import { social, socialCallback, _oauthStates } from './social.js';

function createApp(userId = 'u1') {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('jwtPayload', { sub: userId });
    await next();
  });
  app.route('/api/social', social);
  return app;
}

function createPublicApp() {
  const app = new Hono();
  app.route('/api/social', socialCallback);
  return app;
}

describe('GET /api/social/connections', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns connected platforms', async () => {
    mockGetSocialConnection.mockResolvedValueOnce({
      platform: 'twitter',
      platformUsername: 'twitteruser',
    });
    mockGetSocialConnection.mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request('/api/social/connections');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      { platform: 'twitter', username: 'twitteruser', connected: true },
      { platform: 'linkedin', username: null, connected: false },
    ]);
  });
});

describe('GET /api/social/:platform/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _oauthStates.clear();
  });

  it('returns authUrl for twitter', async () => {
    const app = createApp();
    const res = await app.request('/api/social/twitter/auth');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authUrl).toContain('x.com');
  });

  it('returns authUrl for linkedin', async () => {
    const app = createApp();
    const res = await app.request('/api/social/linkedin/auth');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authUrl).toContain('linkedin.com');
  });

  it('returns 400 for unsupported platform', async () => {
    const app = createApp();
    const res = await app.request('/api/social/facebook/auth');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/social/:platform/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _oauthStates.clear();
  });

  it('rejects expired/invalid state', async () => {
    const app = createPublicApp();
    const res = await app.request('/api/social/twitter/callback?code=abc&state=bad-state');
    expect(res.status).toBe(400);
  });

  it('rejects missing code', async () => {
    _oauthStates.set('valid-state', {
      userId: 'u1',
      codeVerifier: 'verifier',
      ts: Date.now(),
    });

    const app = createPublicApp();
    const res = await app.request('/api/social/twitter/callback?state=valid-state');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/social/:platform', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes connection', async () => {
    mockGetSocialConnection.mockResolvedValue({ id: 'c1', platform: 'twitter' });
    mockDeleteSocialConnection.mockResolvedValue(undefined);

    const app = createApp();
    const res = await app.request('/api/social/twitter', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(mockDeleteSocialConnection).toHaveBeenCalledWith('u1', 'twitter');
  });

  it('returns 404 when not connected', async () => {
    mockGetSocialConnection.mockResolvedValue(undefined);

    const app = createApp();
    const res = await app.request('/api/social/twitter', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
