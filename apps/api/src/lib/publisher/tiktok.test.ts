import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCreatorInfo = vi.fn();
const mockInitDirectPost = vi.fn();
const mockGetPublishStatus = vi.fn();

vi.mock('../tiktok/client.js', () => ({
  getTiktokCreatorInfo: (...args: unknown[]) => mockGetCreatorInfo(...args),
  initTiktokDirectPost: (...args: unknown[]) => mockInitDirectPost(...args),
  getTiktokPublishStatus: (...args: unknown[]) => mockGetPublishStatus(...args),
}));

import { tiktokPublisher } from './tiktok.js';

describe('tiktokPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts an async publish and returns publishing state', async () => {
    mockGetCreatorInfo.mockResolvedValue({
      creatorUsername: 'creator',
      creatorNickname: 'Creator',
      creatorAvatarUrl: 'https://avatar.test',
      privacyLevelOptions: ['SELF_ONLY'],
      commentDisabled: false,
      duetDisabled: false,
      stitchDisabled: false,
      maxVideoPostDurationSec: 600,
      canPost: true,
      fetchedAt: '2026-03-17T10:00:00Z',
    });
    mockInitDirectPost.mockResolvedValue({
      publishId: 'pub-123',
      publishStatus: 'PROCESSING_UPLOAD',
    });

    const result = await tiktokPublisher.publish({
      content: 'Ship it',
      accessToken: 'token',
      postId: 'post-1',
      media: [
        {
          url: 'https://cdn.test/video.mp4',
          buffer: Buffer.from('video'),
          mimeType: 'video/mp4',
          type: 'video',
        },
      ],
      platformContext: {
        sessionId: 'sess-1',
        tiktokSettings: {
          privacyLevel: 'SELF_ONLY',
          allowComment: true,
          allowDuet: true,
          allowStitch: true,
          videoCoverTimestampMs: null,
          brandContentToggle: false,
          brandOrganicToggle: false,
          isAigc: true,
          consentConfirmed: true,
        },
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        state: 'publishing',
        platformPublishId: 'pub-123',
        platformStatus: 'PROCESSING_UPLOAD',
      })
    );
  });

  it('maps rate-limit errors', async () => {
    mockGetCreatorInfo.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }));

    const result = await tiktokPublisher.publish({
      content: 'Ship it',
      accessToken: 'token',
      postId: 'post-1',
      media: [
        {
          url: 'https://cdn.test/video.mp4',
          buffer: Buffer.from('video'),
          mimeType: 'video/mp4',
          type: 'video',
        },
      ],
      platformContext: {
        sessionId: 'sess-1',
        tiktokSettings: {
          privacyLevel: 'SELF_ONLY',
          allowComment: true,
          allowDuet: true,
          allowStitch: true,
          videoCoverTimestampMs: null,
          brandContentToggle: false,
          brandOrganicToggle: false,
          isAigc: true,
          consentConfirmed: true,
        },
      },
    });

    expect(result).toEqual({ success: false, error: 'Rate limit exceeded — try again later' });
  });

  it('maps async publish completion during status sync', async () => {
    mockGetPublishStatus.mockResolvedValue({
      publishId: 'pub-123',
      publishStatus: 'PUBLISH_COMPLETE',
      platformPostId: 'video-123',
      failReason: null,
    });

    const result = await tiktokPublisher.syncStatus?.({
      accessToken: 'token',
      platformPublishId: 'pub-123',
      platformContext: { sessionId: 'sess-1' },
    });

    expect(result).toEqual({
      success: true,
      state: 'posted',
      platformPostId: 'video-123',
      platformPublishId: 'pub-123',
      platformStatus: 'PUBLISH_COMPLETE',
      error: undefined,
    });
  });
});
