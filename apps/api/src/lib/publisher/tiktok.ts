import {
  getTiktokCreatorInfo,
  getTiktokPublishStatus,
  initTiktokDirectPost,
} from '../tiktok/client.js';
import type { Publisher, PublishResult } from './types.js';

function mapPublisherError(err: any): PublishResult {
  const status = err?.status ?? err?.statusCode;

  if (status === 401) {
    return { success: false, error: 'Invalid or expired token — please reconnect' };
  }
  if (status === 429) {
    return { success: false, error: 'Rate limit exceeded — try again later' };
  }

  return { success: false, error: err?.message ?? 'Unknown TikTok error' };
}

export const tiktokPublisher: Publisher = {
  async publish(context) {
    try {
      const sessionId = context.platformContext?.sessionId ?? crypto.randomUUID();
      const settings = context.platformContext?.tiktokSettings;
      const video = context.media?.find((item) => item.type === 'video');

      if (!settings) {
        return { success: false, error: 'TikTok settings are required' };
      }
      if (!video) {
        return { success: false, error: 'TikTok publish requires a video' };
      }

      const creatorInfo = await getTiktokCreatorInfo(context.accessToken, sessionId);
      const init = await initTiktokDirectPost({
        accessToken: context.accessToken,
        sessionId,
        videoUrl: video.url,
        caption: context.content,
        settings,
      });

      return {
        success: true,
        state: 'publishing',
        platformPublishId: init.publishId,
        platformStatus: init.publishStatus,
        tiktokState: {
          creatorInfo,
          publishId: init.publishId,
          publishStatus: init.publishStatus,
          failReason: null,
          proxy: null,
        },
      };
    } catch (err: any) {
      return mapPublisherError(err);
    }
  },

  async syncStatus(context) {
    try {
      const sessionId = context.platformContext?.sessionId ?? crypto.randomUUID();
      const status = await getTiktokPublishStatus(
        context.accessToken,
        context.platformPublishId,
        sessionId
      );

      if (status.publishStatus === 'PUBLISH_COMPLETE') {
        return {
          success: true,
          state: 'posted',
          platformPostId: status.platformPostId,
          platformPublishId: status.publishId,
          platformStatus: status.publishStatus,
        };
      }

      if (['FAILED', 'PUBLISH_FAILED', 'SEND_TO_USER_INBOX_FAILED'].includes(status.publishStatus)) {
        return {
          success: true,
          state: 'rejected',
          platformPostId: status.platformPostId,
          platformPublishId: status.publishId,
          platformStatus: status.publishStatus,
          error: status.failReason ?? 'TikTok publishing failed',
        };
      }

      return {
        success: true,
        state: 'publishing',
        platformPostId: status.platformPostId,
        platformPublishId: status.publishId,
        platformStatus: status.publishStatus,
        error: status.failReason ?? undefined,
      };
    } catch (err: any) {
      return mapPublisherError(err);
    }
  },
};
