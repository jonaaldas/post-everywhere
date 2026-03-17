import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../env.js', () => ({
  env: {
    appBaseUrl: 'https://app.test',
    tiktokClientKey: 'tt-client-key',
    tiktokClientSecret: 'tt-client-secret',
  },
}));

const mockTiktokFetch = vi.fn();
vi.mock('./proxy.js', () => ({
  tiktokFetch: (...args: unknown[]) => mockTiktokFetch(...args),
}));

import { buildTiktokAuthUrl, exchangeTiktokCode, refreshTiktokAccessToken } from './oauth.js';

describe('lib/tiktok/oauth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds the TikTok auth URL with PKCE and video.publish scope', () => {
    const authUrl = buildTiktokAuthUrl({
      state: 'state-1',
      codeChallenge: 'challenge-1',
      redirectUri: 'https://app.test/api/social/tiktok/callback',
    });

    expect(authUrl).toContain('https://www.tiktok.com/v2/auth/authorize/');
    expect(authUrl).toContain('client_key=tt-client-key');
    expect(authUrl).toContain('scope=video.publish');
    expect(authUrl).toContain('code_challenge=challenge-1');
    expect(authUrl).toContain('state=state-1');
  });

  it('exchanges an auth code for TikTok tokens', async () => {
    mockTiktokFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'tt-access',
        refresh_token: 'tt-refresh',
        expires_in: 3600,
        refresh_expires_in: 86400,
      }),
    });

    const tokens = await exchangeTiktokCode({
      code: 'auth-code',
      codeVerifier: 'verifier',
      redirectUri: 'https://app.test/api/social/tiktok/callback',
      sessionId: 'sess-1',
    });

    expect(tokens.accessToken).toBe('tt-access');
    expect(tokens.refreshToken).toBe('tt-refresh');
    expect(tokens.expiresIn).toBe(3600);
    expect(tokens.refreshExpiresIn).toBe(86400);
  });

  it('refreshes a TikTok access token', async () => {
    mockTiktokFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 7200,
        refresh_expires_in: 1209600,
      }),
    });

    const tokens = await refreshTiktokAccessToken('refresh-token', 'sess-2');

    expect(tokens.accessToken).toBe('new-access');
    expect(tokens.refreshToken).toBe('new-refresh');
    expect(tokens.expiresIn).toBe(7200);
    expect(tokens.refreshExpiresIn).toBe(1209600);
  });
});
