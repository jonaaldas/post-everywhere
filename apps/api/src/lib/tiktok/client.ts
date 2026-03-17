import type { TiktokCreatorInfo, TiktokSettings } from './types.js';
import { tiktokFetch } from './proxy.js';

function extractData<T>(payload: Record<string, any>): T {
  return (payload.data ?? payload) as T;
}

async function readJson(res: Response): Promise<Record<string, any>> {
  const payload = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    const error = new Error(payload.error?.message ?? payload.message ?? `TikTok API error: ${res.status}`) as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }
  return payload;
}

export async function getTiktokCreatorInfo(
  accessToken: string,
  sessionId: string
): Promise<TiktokCreatorInfo> {
  const res = await tiktokFetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
    method: 'POST',
    sessionId,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const data = extractData<Record<string, any>>(await readJson(res));

  return {
    creatorUsername: data.creator_username ?? '',
    creatorNickname: data.creator_nickname ?? '',
    creatorAvatarUrl: data.creator_avatar_url ?? '',
    privacyLevelOptions: data.privacy_level_options ?? [],
    commentDisabled: Boolean(data.comment_disabled),
    duetDisabled: Boolean(data.duet_disabled),
    stitchDisabled: Boolean(data.stitch_disabled),
    maxVideoPostDurationSec: Number(data.max_video_post_duration_sec ?? 0),
    canPost: data.can_post !== false,
    fetchedAt: new Date().toISOString(),
  };
}

export async function initTiktokDirectPost(input: {
  accessToken: string;
  sessionId: string;
  videoUrl: string;
  caption: string;
  settings: TiktokSettings;
}): Promise<{ publishId: string; publishStatus: string }> {
  const res = await tiktokFetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    sessionId: input.sessionId,
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: input.caption,
        privacy_level: input.settings.privacyLevel,
        disable_comment: !input.settings.allowComment,
        disable_duet: !input.settings.allowDuet,
        disable_stitch: !input.settings.allowStitch,
        video_cover_timestamp_ms: input.settings.videoCoverTimestampMs,
        brand_content_toggle: input.settings.brandContentToggle,
        brand_organic_toggle: input.settings.brandOrganicToggle,
        is_aigc: input.settings.isAigc,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: input.videoUrl,
      },
    }),
  });

  const data = extractData<Record<string, any>>(await readJson(res));
  return {
    publishId: data.publish_id,
    publishStatus: data.publish_status ?? 'PROCESSING_UPLOAD',
  };
}

export async function getTiktokPublishStatus(
  accessToken: string,
  publishId: string,
  sessionId: string
): Promise<{
  publishId: string;
  publishStatus: string;
  platformPostId?: string;
  failReason?: string | null;
}> {
  const res = await tiktokFetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
    method: 'POST',
    sessionId,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publish_id: publishId }),
  });

  const data = extractData<Record<string, any>>(await readJson(res));
  return {
    publishId,
    publishStatus: data.publish_status ?? data.status ?? 'UNKNOWN',
    platformPostId:
      data.platform_post_id ??
      data.publicly_available_post_id ??
      data.publicaly_available_post_id ??
      data.video_id,
    failReason: data.fail_reason ?? null,
  };
}
