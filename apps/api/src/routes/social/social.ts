import { createHash, randomUUID } from 'node:crypto';
import { Hono } from 'hono';

import { env } from '../../env.js';
import { encrypt } from '../../lib/crypto/crypto.js';
import {
  getSocialConnection,
  saveSocialConnection,
  deleteSocialConnection,
  updateSocialTokens,
} from '../../db/social/social.js';
import { getTiktokCreatorInfo } from '../../lib/tiktok/client.js';
import { buildTiktokAuthUrl, exchangeTiktokCode } from '../../lib/tiktok/oauth.js';
import { verifyTiktokProxyEgress } from '../../lib/tiktok/proxy.js';
import { decrypt } from '../../lib/crypto/crypto.js';
import { refreshAccessToken } from '../../lib/publisher/refresh.js';

// --- OAuth state store (in-memory, 10-min TTL) ---

interface OAuthState {
  userId: string;
  codeVerifier: string;
  ts: number;
}

const TTL_MS = 10 * 60 * 1000;

export const _oauthStates = new Map<string, OAuthState>();

function cleanExpiredStates() {
  const now = Date.now();
  for (const [key, val] of _oauthStates) {
    if (now - val.ts > TTL_MS) _oauthStates.delete(key);
  }
}

function consumeState(state: string): OAuthState | undefined {
  cleanExpiredStates();
  const entry = _oauthStates.get(state);
  if (entry) _oauthStates.delete(state);
  return entry;
}

// --- Helpers ---

const PLATFORMS = ['twitter', 'linkedin', 'tiktok'] as const;
type Platform = (typeof PLATFORMS)[number];

function isPlatform(v: string): v is Platform {
  return (PLATFORMS as readonly string[]).includes(v);
}

function getCallbackUrl(platform: string): string {
  return `${env.appBaseUrl}/api/social/${platform}/callback`;
}

function buildPkceChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

async function getValidTikTokAccessToken(connection: {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
}, userId: string): Promise<string> {
  const REFRESH_BUFFER_MS = 5 * 60 * 1000;
  if (
    !connection.tokenExpiresAt ||
    new Date(connection.tokenExpiresAt).getTime() >= Date.now() + REFRESH_BUFFER_MS
  ) {
    return decrypt(connection.accessToken);
  }

  const refreshToken = connection.refreshToken ? decrypt(connection.refreshToken) : null;
  const refreshed = await refreshAccessToken('tiktok', refreshToken);
  await updateSocialTokens(userId, 'tiktok', {
    accessToken: encrypt(refreshed.accessToken),
    refreshToken: refreshed.refreshToken ? encrypt(refreshed.refreshToken) : undefined,
    refreshTokenExpiresAt: refreshed.refreshExpiresIn
      ? new Date(Date.now() + refreshed.refreshExpiresIn * 1000).toISOString()
      : null,
    tokenExpiresAt: refreshed.expiresIn
      ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
      : null,
  });
  return refreshed.accessToken;
}

// --- Public routes (OAuth callbacks — mounted before JWT middleware in index.ts) ---

const socialCallback = new Hono();

socialCallback.get('/:platform/callback', async (c) => {
  const platform = c.req.param('platform');
  const code = c.req.query('code');
  const stateParam = c.req.query('state');

  if (!code) {
    return c.json({ error: 'missing code' }, 400);
  }
  if (!stateParam) {
    return c.json({ error: 'missing state' }, 400);
  }
  if (!isPlatform(platform)) {
    return c.json({ error: 'unsupported platform' }, 400);
  }

  const oauthState = consumeState(stateParam);
  if (!oauthState) {
    return c.json({ error: 'invalid or expired state' }, 400);
  }

  try {
    let accessToken: string;
    let refreshToken: string | null = null;
    let platformUserId: string;
    let platformUsername: string;
    let tokenExpiresAt: string | null = null;
    let refreshTokenExpiresAt: string | null = null;

    if (platform === 'twitter') {
      const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${env.twitterClientId}:${env.twitterClientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          redirect_uri: getCallbackUrl('twitter'),
          code_verifier: oauthState.codeVerifier,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return c.json({ error: `Twitter token exchange failed: ${err}` }, 400);
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token ?? null;
      if (tokens.expires_in) {
        tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      }

      const meRes = await fetch('https://api.x.com/2/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) {
        const err = await meRes.text();
        return c.json({ error: `Twitter user lookup failed: ${err}` }, 400);
      }
      const me = (await meRes.json()) as { data: { id: string; username: string } };
      platformUserId = me.data.id;
      platformUsername = me.data.username;
    } else if (platform === 'linkedin') {
      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: getCallbackUrl('linkedin'),
          client_id: env.linkedinClientId,
          client_secret: env.linkedinClientSecret,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return c.json({ error: `LinkedIn token exchange failed: ${err}` }, 400);
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };
      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token ?? null;
      if (tokens.expires_in) {
        tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      }

      const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meRes.ok) {
        const err = await meRes.text();
        return c.json({ error: `LinkedIn user lookup failed: ${err}` }, 400);
      }
      const me = (await meRes.json()) as { sub: string; name: string };
      platformUserId = me.sub;
      platformUsername = me.name;
    } else {
      const sessionId = randomUUID();
      const tokens = await exchangeTiktokCode({
        code,
        codeVerifier: oauthState.codeVerifier,
        redirectUri: getCallbackUrl('tiktok'),
        sessionId,
      });

      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken ?? null;
      if (tokens.expiresIn) {
        tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
      }
      if (tokens.refreshExpiresIn) {
        refreshTokenExpiresAt = new Date(Date.now() + tokens.refreshExpiresIn * 1000).toISOString();
      }

      await verifyTiktokProxyEgress(sessionId);
      const creatorInfo = await getTiktokCreatorInfo(accessToken, sessionId);
      platformUserId = creatorInfo.creatorUsername;
      platformUsername = creatorInfo.creatorUsername;
    }

    await saveSocialConnection({
      userId: oauthState.userId,
      platform,
      accessToken: encrypt(accessToken),
      refreshToken: refreshToken ? encrypt(refreshToken) : null,
      refreshTokenExpiresAt,
      platformUserId,
      platformUsername,
      tokenExpiresAt,
    });

    return c.redirect(`${env.appBaseUrl}/settings?connected=${platform}`);
  } catch (err: any) {
    return c.json({ error: err.message ?? 'OAuth callback failed' }, 500);
  }
});

// --- Protected routes (JWT required — mounted after JWT middleware in index.ts) ---

const social = new Hono();

social.get('/connections', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;

  const results = await Promise.all(
    PLATFORMS.map(async (platform) => {
      const conn = await getSocialConnection(userId, platform);
      return {
        platform,
        username: conn?.platformUsername ?? null,
        connected: !!conn,
      };
    })
  );

  return c.json(results);
});

social.get('/:platform/auth', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const platform = c.req.param('platform');

  if (!isPlatform(platform)) {
    return c.json({ error: 'unsupported platform' }, 400);
  }

  const state = randomUUID();
  const codeVerifier = randomUUID();
  _oauthStates.set(state, { userId, codeVerifier, ts: Date.now() });

  let authUrl: string;

  if (platform === 'twitter') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.twitterClientId,
      redirect_uri: getCallbackUrl('twitter'),
      scope: 'tweet.read tweet.write users.read offline.access media.write',
      state,
      code_challenge: codeVerifier,
      code_challenge_method: 'plain',
    });
    authUrl = `https://x.com/i/oauth2/authorize?${params}`;
  } else if (platform === 'linkedin') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.linkedinClientId,
      redirect_uri: getCallbackUrl('linkedin'),
      scope: 'profile openid w_member_social',
      state,
    });
    authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  } else {
    authUrl = buildTiktokAuthUrl({
      state,
      codeChallenge: buildPkceChallenge(codeVerifier),
      redirectUri: getCallbackUrl('tiktok'),
    });
  }

  return c.json({ authUrl });
});

social.get('/tiktok/creator-info', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const connection = await getSocialConnection(userId, 'tiktok');

  if (!connection) {
    return c.json({ error: 'tiktok not connected' }, 404);
  }

  try {
    const sessionId = randomUUID();
    const accessToken = await getValidTikTokAccessToken(connection, userId);
    const proxy = await verifyTiktokProxyEgress(sessionId);
    const creatorInfo = await getTiktokCreatorInfo(accessToken, sessionId);
    return c.json({ creatorInfo, proxy });
  } catch (err: any) {
    return c.json({ error: err.message ?? 'Failed to load TikTok creator info' }, 500);
  }
});

social.delete('/:platform', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const platform = c.req.param('platform');

  if (!isPlatform(platform)) {
    return c.json({ error: 'unsupported platform' }, 400);
  }

  const conn = await getSocialConnection(userId, platform);
  if (!conn) {
    return c.json({ error: 'not connected' }, 404);
  }

  await deleteSocialConnection(userId, platform);
  return c.json({ disconnected: true });
});

export { social, socialCallback };
