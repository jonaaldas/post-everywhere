import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTweet = vi.fn();

vi.mock('twitter-api-v2', () => {
  return {
    TwitterApi: class {
      v2 = { tweet: mockTweet };
    },
  };
});

import { twitterPublisher } from './twitter.js';

describe('twitterPublisher', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publishes successfully', async () => {
    mockTweet.mockResolvedValue({ data: { id: '12345' } });

    const result = await twitterPublisher.publish({
      content: 'Hello world',
      accessToken: 'access-token',
      postId: 'post-1',
    });
    expect(result).toEqual({ success: true, state: 'posted', platformPostId: '12345' });
    expect(mockTweet).toHaveBeenCalledWith({ text: 'Hello world' });
  });

  it('returns error on failure', async () => {
    mockTweet.mockRejectedValue(new Error('Something went wrong'));

    const result = await twitterPublisher.publish({ content: 'Hello', accessToken: 'token', postId: 'post-1' });
    expect(result).toEqual({ success: false, error: 'Something went wrong' });
  });

  it('detects rate limit', async () => {
    const err = new Error('Rate limit');
    (err as any).code = 429;
    mockTweet.mockRejectedValue(err);

    const result = await twitterPublisher.publish({ content: 'Hello', accessToken: 'token', postId: 'post-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limit');
  });

  it('detects expired/invalid token', async () => {
    const err = new Error('Invalid or expired token');
    (err as any).code = 401;
    mockTweet.mockRejectedValue(err);

    const result = await twitterPublisher.publish({ content: 'Hello', accessToken: 'token', postId: 'post-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });
});
