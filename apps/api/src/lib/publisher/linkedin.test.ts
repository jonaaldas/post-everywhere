import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { linkedinPublisher } from './linkedin.js';

describe('linkedinPublisher', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publishes successfully', async () => {
    // First call: get profile
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sub: 'abc123' }),
    });
    // Second call: create post
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: { get: () => 'urn:li:share:456' },
      json: () => Promise.resolve({ id: 'urn:li:share:456' }),
    });

    const result = await linkedinPublisher.publish({
      content: 'Hello LinkedIn',
      accessToken: 'access-token',
      postId: 'post-1',
    });
    expect(result).toEqual({ success: true, state: 'posted', platformPostId: 'urn:li:share:456' });
  });

  it('returns error on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sub: 'abc123' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Internal error' }),
    });

    const result = await linkedinPublisher.publish({ content: 'Hello', accessToken: 'token', postId: 'post-1' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('detects rate limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sub: 'abc123' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ message: 'Rate limited' }),
    });

    const result = await linkedinPublisher.publish({ content: 'Hello', accessToken: 'token', postId: 'post-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limit');
  });

  it('detects expired token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    });

    const result = await linkedinPublisher.publish({ content: 'Hello', accessToken: 'token', postId: 'post-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });
});
