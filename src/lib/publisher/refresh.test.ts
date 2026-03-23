import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../env.js', () => ({
  env: {
    twitterClientId: 'tw-client-id',
    twitterClientSecret: 'tw-client-secret',
    linkedinClientId: 'li-client-id',
    linkedinClientSecret: 'li-client-secret',
  },
}));

import { refreshAccessToken } from './refresh.js';

describe('refreshAccessToken', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws when refresh token is missing', async () => {
    await expect(refreshAccessToken('twitter', undefined)).rejects.toThrow('No refresh token');
    await expect(refreshAccessToken('twitter', null)).rejects.toThrow('No refresh token');
  });

  describe('twitter', () => {
    it('refreshes successfully', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 7200,
        }),
      });

      const result = await refreshAccessToken('twitter', 'old-refresh');

      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 7200,
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.x.com/2/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('throws on API error', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      });

      await expect(refreshAccessToken('twitter', 'bad-refresh')).rejects.toThrow(
        'Twitter token refresh failed'
      );
    });
  });

  describe('linkedin', () => {
    it('refreshes successfully', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-li-access',
          refresh_token: 'new-li-refresh',
          expires_in: 5184000,
        }),
      });

      const result = await refreshAccessToken('linkedin', 'old-li-refresh');

      expect(result).toEqual({
        accessToken: 'new-li-access',
        refreshToken: 'new-li-refresh',
        expiresIn: 5184000,
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://www.linkedin.com/oauth/v2/accessToken',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('throws on API error', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'invalid_refresh_token',
      });

      await expect(refreshAccessToken('linkedin', 'bad-refresh')).rejects.toThrow(
        'LinkedIn token refresh failed'
      );
    });
  });
});
