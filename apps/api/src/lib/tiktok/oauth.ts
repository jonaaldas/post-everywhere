import { env } from '../../env.js';
import { tiktokFetch } from './proxy.js';

interface TiktokTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
}

function mapTokenResult(payload: Record<string, any>): TiktokTokenResult {
  const data = payload.data ?? payload;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    refreshExpiresIn: data.refresh_expires_in,
  };
}

export function buildTiktokAuthUrl(input: {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}): string {
  const params = new URLSearchParams({
    client_key: env.tiktokClientKey,
    response_type: 'code',
    scope: 'video.publish',
    redirect_uri: input.redirectUri,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
}

export async function exchangeTiktokCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  sessionId: string;
}): Promise<TiktokTokenResult> {
  const res = await tiktokFetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    sessionId: input.sessionId,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: env.tiktokClientKey,
      client_secret: env.tiktokClientSecret,
      code: input.code,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    }),
  });

  if (!res.ok) {
    throw new Error(`TikTok token exchange failed: ${await res.text()}`);
  }

  return mapTokenResult((await res.json()) as Record<string, any>);
}

export async function refreshTiktokAccessToken(
  refreshToken: string,
  sessionId: string
): Promise<TiktokTokenResult> {
  const res = await tiktokFetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    sessionId,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: env.tiktokClientKey,
      client_secret: env.tiktokClientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`TikTok token refresh failed: ${await res.text()}`);
  }

  return mapTokenResult((await res.json()) as Record<string, any>);
}
