import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../env.js', () => ({
  env: {
    evomiProxyHost: 'rp.evomi.test',
    evomiProxyPort: '1000',
    evomiProxyUsername: 'user',
    evomiProxyPassword: 'pass',
    evomiProxyCountry: 'US',
    evomiProxySessionLifetimeMinutes: 30,
    tiktokProxyVerifyUrl: 'https://ip.evomi.com/s',
    tiktokProxyRequired: true,
  },
}));

const mockImpitFetch = vi.fn();
const mockImpitCtor = vi.fn();

vi.mock('impit', () => ({
  Impit: class {
    constructor(options: unknown) {
      mockImpitCtor(options);
    }

    fetch(input: string, init?: RequestInit) {
      return mockImpitFetch(input, init);
    }
  },
}));

import { buildEvomiProxyUrl, tiktokFetch, verifyTiktokProxyEgress } from './proxy.js';

describe('lib/tiktok/proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a sticky US EVOMI proxy URL', () => {
    expect(buildEvomiProxyUrl('session-123')).toBe(
      'http://user:pass_country-US_session-session-123_lifetime-30@rp.evomi.test:1000'
    );
  });

  it('verifies a US proxy egress', async () => {
    mockImpitFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ip: '1.2.3.4', country: 'US' }),
    });

    const state = await verifyTiktokProxyEgress('session-1');

    expect(state.provider).toBe('evomi');
    expect(state.country).toBe('US');
    expect(state.sessionId).toBe('session-1');
    expect(state.exitIp).toBe('1.2.3.4');
    expect(mockImpitCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        browser: 'chrome',
        proxyUrl: 'http://user:pass_country-US_session-session-1_lifetime-30@rp.evomi.test:1000',
      })
    );
  });

  it('fails closed when the proxy egress is not US', async () => {
    mockImpitFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ip: '5.6.7.8', country: 'DE' }),
    });

    await expect(verifyTiktokProxyEgress('session-2')).rejects.toThrow('Proxy egress must be US');
  });

  it('routes TikTok fetches through Impit', async () => {
    const response = { ok: true, json: async () => ({ ok: true }) };
    mockImpitFetch.mockResolvedValue(response);

    const result = await tiktokFetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
      method: 'POST',
      sessionId: 'session-3',
    });

    expect(result).toBe(response);
    expect(mockImpitFetch).toHaveBeenCalledWith(
      'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
