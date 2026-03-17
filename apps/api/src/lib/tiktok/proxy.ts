import { Impit } from 'impit';

import { env } from '../../env.js';
import type { TiktokProxyState } from './types.js';

interface TiktokFetchInit extends RequestInit {
  sessionId?: string;
}

function createImpit(sessionId: string): Impit {
  return new Impit({
    browser: 'chrome',
    proxyUrl: buildEvomiProxyUrl(sessionId),
  });
}

export function buildEvomiProxyUrl(sessionId: string): string {
  return `http://${env.evomiProxyUsername}:${env.evomiProxyPassword}_country-${env.evomiProxyCountry}_session-${sessionId}_lifetime-${env.evomiProxySessionLifetimeMinutes}@${env.evomiProxyHost}:${env.evomiProxyPort}`;
}

export async function verifyTiktokProxyEgress(sessionId: string): Promise<TiktokProxyState> {
  const impit = createImpit(sessionId);
  const res = await impit.fetch(env.tiktokProxyVerifyUrl);

  if (!res.ok) {
    throw new Error(`Failed to verify TikTok proxy egress: ${res.status}`);
  }

  const body = (await res.json()) as { ip?: string; country?: string };
  const country = body.country?.toUpperCase() ?? '';

  if (env.tiktokProxyRequired && country !== 'US') {
    throw new Error('Proxy egress must be US');
  }

  return {
    provider: 'evomi',
    country: 'US',
    sessionId,
    exitIp: body.ip ?? null,
    verifiedAt: new Date().toISOString(),
  };
}

export async function tiktokFetch(url: string, init: TiktokFetchInit = {}): Promise<Response> {
  const { sessionId = crypto.randomUUID(), ...requestInit } = init;
  const impit = createImpit(sessionId);
  const response = await impit.fetch(url, requestInit as any);
  return response as unknown as Response;
}
