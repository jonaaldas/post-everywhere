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
    tiktokClientKey: 'tt-client-key',
    tiktokClientSecret: 'tt-client-secret',
    tiktokProxyRequired: true,
    evomiProxyHost: 'rp.evomi.test',
    evomiProxyPort: '1000',
    evomiProxyUsername: 'user',
    evomiProxyPassword: 'pass',
    evomiProxyCountry: 'US',
    evomiProxySessionLifetimeMinutes: 30,
    tiktokProxyVerifyUrl: 'https://ip.evomi.com/s',
  },
}));

const mockGetSocialConnection = vi.fn();
const mockSaveSocialConnection = vi.fn();
const mockDeleteSocialConnection = vi.fn();
const mockUpdateSocialTokens = vi.fn();

vi.mock('../../db/social/social.js', () => ({
  getSocialConnection: (...args: unknown[]) => mockGetSocialConnection(...args),
  saveSocialConnection: (...args: unknown[]) => mockSaveSocialConnection(...args),
  deleteSocialConnection: (...args: unknown[]) => mockDeleteSocialConnection(...args),
  updateSocialTokens: (...args: unknown[]) => mockUpdateSocialTokens(...args),
}));

const mockEncrypt = vi.fn((v: string) => `enc:${v}`);
const mockDecrypt = vi.fn((v: string) => v.replace('enc:', ''));

vi.mock('../../lib/crypto/crypto.js', () => ({
  encrypt: (v: string) => mockEncrypt(v),
  decrypt: (v: string) => mockDecrypt(v),
}));

const mockBuildTiktokAuthUrl = vi.fn(() => 'https://www.tiktok.com/v2/auth/authorize/?client_key=tt-client-key');
const mockExchangeTiktokCode = vi.fn();
vi.mock('../../lib/tiktok/oauth.js', () => ({
  buildTiktokAuthUrl: (...args: unknown[]) => mockBuildTiktokAuthUrl(...args),
  exchangeTiktokCode: (...args: unknown[]) => mockExchangeTiktokCode(...args),
}));

const mockGetTiktokCreatorInfo = vi.fn();
vi.mock('../../lib/tiktok/client.js', () => ({
  getTiktokCreatorInfo: (...args: unknown[]) => mockGetTiktokCreatorInfo(...args),
}));

const mockVerifyTiktokProxyEgress = vi.fn();
vi.mock('../../lib/tiktok/proxy.js', () => ({
  verifyTiktokProxyEgress: (...args: unknown[]) => mockVerifyTiktokProxyEgress(...args),
}));

const mockRefreshAccessToken = vi.fn();
vi.mock('../../lib/publisher/refresh.js', () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
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
    mockGetSocialConnection.mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request('/api/social/connections');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([
      { platform: 'twitter', username: 'twitteruser', connected: true },
      { platform: 'linkedin', username: null, connected: false },
      { platform: 'tiktok', username: null, connected: false },
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

  it('returns authUrl for tiktok', async () => {
    const app = createApp();
    const res = await app.request('/api/social/tiktok/auth');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authUrl).toContain('tiktok.com');
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

  it('handles TikTok callback and stores tokens', async () => {
    _oauthStates.set('valid-state', {
      userId: 'u1',
      codeVerifier: 'verifier',
      ts: Date.now(),
    });
    mockExchangeTiktokCode.mockResolvedValue({
      accessToken: 'tt-access',
      refreshToken: 'tt-refresh',
      expiresIn: 3600,
      refreshExpiresIn: 86400,
    });
    mockVerifyTiktokProxyEgress.mockResolvedValue({
      provider: 'evomi',
      country: 'US',
      sessionId: 'sess-1',
      exitIp: '1.2.3.4',
      verifiedAt: '2026-03-17T10:00:00Z',
    });
    mockGetTiktokCreatorInfo.mockResolvedValue({
      creatorUsername: 'creator_user',
    });

    const app = createPublicApp();
    const res = await app.request('/api/social/tiktok/callback?code=abc&state=valid-state');

    expect(res.status).toBe(302);
    expect(mockSaveSocialConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        platform: 'tiktok',
        accessToken: 'enc:tt-access',
        refreshToken: 'enc:tt-refresh',
        platformUserId: 'creator_user',
        platformUsername: 'creator_user',
      })
    );
  });
});

describe('GET /api/social/tiktok/creator-info', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns creator info for a connected TikTok account', async () => {
    mockGetSocialConnection.mockResolvedValue({
      accessToken: 'enc:tt-access',
      refreshToken: 'enc:tt-refresh',
      tokenExpiresAt: null,
    });
    mockVerifyTiktokProxyEgress.mockResolvedValue({
      provider: 'evomi',
      country: 'US',
      sessionId: 'sess-1',
      exitIp: '1.2.3.4',
      verifiedAt: '2026-03-17T10:00:00Z',
    });
    mockGetTiktokCreatorInfo.mockResolvedValue({
      creatorUsername: 'creator_user',
      creatorNickname: 'Creator',
      creatorAvatarUrl: 'https://avatar.test',
      privacyLevelOptions: ['SELF_ONLY'],
      commentDisabled: false,
      duetDisabled: false,
      stitchDisabled: false,
      maxVideoPostDurationSec: 600,
      canPost: true,
      fetchedAt: '2026-03-17T10:00:00Z',
    });

    const app = createApp();
    const res = await app.request('/api/social/tiktok/creator-info');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creatorInfo.creatorUsername).toBe('creator_user');
    expect(body.proxy.country).toBe('US');
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
