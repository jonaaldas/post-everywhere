import { TwitterApi } from 'twitter-api-v2';

import type { Publisher, PublishResult, MediaItem } from './types.js';

async function uploadMediaToX(accessToken: string, item: MediaItem): Promise<string> {
  const formData = new FormData();
  formData.append('media', new Blob([new Uint8Array(item.buffer)], { type: item.mimeType }));
  formData.append('media_category', 'tweet_image');
  formData.append('media_type', item.mimeType);

  const res = await fetch('https://api.x.com/2/media/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`X media upload failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { data: { id: string } };
  return data.data.id;
}

export const twitterPublisher: Publisher = {
  async publish(content: string, accessToken: string, media?: MediaItem[]): Promise<PublishResult> {
    try {
      const mediaIds: string[] = [];

      // Upload media via X API v2 (images only for now)
      if (media?.length) {
        const images = media.filter((m) => m.type === 'image').slice(0, 4); // max 4 images
        for (const item of images) {
          const mediaId = await uploadMediaToX(accessToken, item);
          mediaIds.push(mediaId);
        }
      }

      const client = new TwitterApi(accessToken);
      const tweetPayload: Record<string, unknown> = { text: content };
      if (mediaIds.length) {
        tweetPayload.media = { media_ids: mediaIds };
      }

      const { data } = await client.v2.tweet(tweetPayload as any);
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
