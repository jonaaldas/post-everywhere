import { TwitterApi } from 'twitter-api-v2';

import type { Publisher, PublishResult } from './types.js';

export const twitterPublisher: Publisher = {
  async publish(content: string, accessToken: string): Promise<PublishResult> {
    try {
      const client = new TwitterApi(accessToken);
      const { data } = await client.v2.tweet(content);
      return { success: true, platformPostId: data.id };
    } catch (err: any) {
      const code = err.code ?? err.status ?? err.statusCode;
      if (code === 401) {
        return { success: false, error: 'Invalid or expired token — please reconnect' };
      }
      if (code === 429 || err.rateLimit) {
        return { success: false, error: 'Rate limit exceeded — try again later' };
      }
      return { success: false, error: err.message ?? 'Unknown Twitter error' };
    }
  },
};
