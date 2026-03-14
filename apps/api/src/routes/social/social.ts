import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';

import { env } from '../../env.js';
import { encrypt } from '../../lib/crypto/crypto.js';
import {
  getSocialConnection,
  saveSocialConnection,
  deleteSocialConnection,
} from '../../db/social/social.js';

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

const PLATFORMS = ['twitter', 'linkedin'] as const;
type Platform = (typeof PLATFORMS)[number];

function isPlatform(v: string): v is Platform {
  return (PLATFORMS as readonly string[]).includes(v);
}

function getCallbackUrl(platform: string): string {
  return `${env.appBaseUrl}/api/social/${platform}/callback`;
}

// --- Public routes (OAuth callbacks, no JWT required) ---

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

    if (platform === 'twitter') {
      const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${env.twitterClientId}:${env.twitterClientSecret}`)}`,
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

      const meRes = await fetch('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const me = (await meRes.json()) as { data: { id: string; username: string } };
      platformUserId = me.data.id;
      platformUsername = me.data.username;
    } else {
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
      const me = (await meRes.json()) as { sub: string; name: string };
      platformUserId = me.sub;
      platformUsername = me.name;
    }

    await saveSocialConnection({
      userId: oauthState.userId,
      platform,
      accessToken: encrypt(accessToken),
      refreshToken: refreshToken ? encrypt(refreshToken) : null,
      platformUserId,
      platformUsername,
      tokenExpiresAt,
    });

    return c.redirect(`${env.appBaseUrl}/settings?connected=${platform}`);
  } catch (err: any) {
    return c.json({ error: err.message ?? 'OAuth callback failed' }, 500);
  }
});

// --- Protected routes (JWT required) ---

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
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: codeVerifier,
      code_challenge_method: 'plain',
    });
    authUrl = `https://twitter.com/i/oauth2/authorize?${params}`;
  } else {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.linkedinClientId,
      redirect_uri: getCallbackUrl('linkedin'),
      scope: 'openid profile w_member_social',
      state,
    });
    authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  }

  return c.json({ authUrl });
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
