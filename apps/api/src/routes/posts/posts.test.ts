import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../env.js', () => ({
  env: { jwtSecret: 'test-secret-key', encryptionKey: '0'.repeat(64) },
}));

const mockListPosts = vi.fn();
const mockGetPost = vi.fn();
const mockUpdatePostStatus = vi.fn();
const mockUpdatePostContent = vi.fn();
const mockUpdatePostMediaUrls = vi.fn();
const mockUpdatePostTiktokSettings = vi.fn();
const mockUpdatePostPlatformState = vi.fn();
const mockDuplicatePost = vi.fn();

vi.mock('../../db/posts/posts.js', () => ({
  listPosts: (...args: unknown[]) => mockListPosts(...args),
  getPost: (...args: unknown[]) => mockGetPost(...args),
  updatePostStatus: (...args: unknown[]) => mockUpdatePostStatus(...args),
  updatePostContent: (...args: unknown[]) => mockUpdatePostContent(...args),
  updatePostMediaUrls: (...args: unknown[]) => mockUpdatePostMediaUrls(...args),
  updatePostTiktokSettings: (...args: unknown[]) => mockUpdatePostTiktokSettings(...args),
  updatePostPlatformState: (...args: unknown[]) => mockUpdatePostPlatformState(...args),
  duplicatePost: (...args: unknown[]) => mockDuplicatePost(...args),
}));

const mockGetSocialConnection = vi.fn();
const mockUpdateSocialTokens = vi.fn();

vi.mock('../../db/social/social.js', () => ({
  getSocialConnection: (...args: unknown[]) => mockGetSocialConnection(...args),
  updateSocialTokens: (...args: unknown[]) => mockUpdateSocialTokens(...args),
}));

const mockDecrypt = vi.fn((v: string) => v.replace('enc:', ''));
const mockEncrypt = vi.fn((v: string) => `enc:${v}`);

vi.mock('../../lib/crypto/crypto.js', () => ({
  decrypt: (v: string) => mockDecrypt(v),
  encrypt: (v: string) => mockEncrypt(v),
}));

const mockPublish = vi.fn();
const mockSyncStatus = vi.fn();

vi.mock('../../lib/publisher/index.js', () => ({
  getPublisher: () => ({ publish: mockPublish, syncStatus: mockSyncStatus }),
}));

const mockRefreshAccessToken = vi.fn();

vi.mock('../../lib/publisher/refresh.js', () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}));

const mockGetVideoDurationSeconds = vi.fn();
vi.mock('../../lib/tiktok/video.js', () => ({
  getVideoDurationSeconds: (...args: unknown[]) => mockGetVideoDurationSeconds(...args),
}));

const mockVerifyTiktokProxyEgress = vi.fn();
vi.mock('../../lib/tiktok/proxy.js', () => ({
  verifyTiktokProxyEgress: (...args: unknown[]) => mockVerifyTiktokProxyEgress(...args),
}));

import { posts } from './posts.js';

function createApp(userId = 'u1') {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('jwtPayload', { sub: userId });
    await next();
  });
  app.route('/api/posts', posts);
  return app;
}

describe('GET /api/posts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns posts list', async () => {
    mockListPosts.mockResolvedValue([{ id: 'p1', platform: 'twitter', content: 'hi', status: 'pending' }]);
    const app = createApp();
    const res = await app.request('/api/posts');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('p1');
  });

  it('passes status filter to listPosts', async () => {
    mockListPosts.mockResolvedValue([]);
    const app = createApp();
    await app.request('/api/posts?status=pending');
    expect(mockListPosts).toHaveBeenCalledWith('u1', { status: 'pending', platform: undefined });
  });

  it('passes platform filter to listPosts', async () => {
    mockListPosts.mockResolvedValue([]);
    const app = createApp();
    await app.request('/api/posts?platform=twitter');
    expect(mockListPosts).toHaveBeenCalledWith('u1', { status: undefined, platform: 'twitter' });
  });
});

describe('GET /api/posts/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the post', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', content: 'hi' });
    const app = createApp();
    const res = await app.request('/api/posts/p1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('p1');
  });

  it('returns 404 when post not found', async () => {
    mockGetPost.mockResolvedValue(undefined);
    const app = createApp();
    const res = await app.request('/api/posts/nope');
    expect(res.status).toBe(404);
  });

  it('returns 403 when post belongs to another user', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'other-user', content: 'hi' });
    const app = createApp();
    const res = await app.request('/api/posts/p1');
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/posts/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates content', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'pending' });
    mockUpdatePostContent.mockResolvedValue({ id: 'p1', content: 'updated' });
    const app = createApp();
    const res = await app.request('/api/posts/p1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'updated' }),
    });
    expect(res.status).toBe(200);
    expect(mockUpdatePostContent).toHaveBeenCalledWith('p1', 'updated');
  });

  it('updates status', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'pending' });
    mockUpdatePostStatus.mockResolvedValue({ id: 'p1', status: 'approved' });
    const app = createApp();
    const res = await app.request('/api/posts/p1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    expect(res.status).toBe(200);
    expect(mockUpdatePostStatus).toHaveBeenCalledWith('p1', 'approved');
  });

  it('returns 404 for missing post', async () => {
    mockGetPost.mockResolvedValue(undefined);
    const app = createApp();
    const res = await app.request('/api/posts/nope', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    expect(res.status).toBe(404);
  });

  it('updates mediaUrls', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'pending' });
    mockUpdatePostMediaUrls.mockResolvedValue({ id: 'p1', mediaUrls: '["https://r2.example.com/img.jpg"]' });
    const app = createApp();
    const res = await app.request('/api/posts/p1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaUrls: ['https://r2.example.com/img.jpg'] }),
    });
    expect(res.status).toBe(200);
    expect(mockUpdatePostMediaUrls).toHaveBeenCalledWith('p1', ['https://r2.example.com/img.jpg']);
  });

  it('returns 400 when no content or status provided', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1' });
    const app = createApp();
    const res = await app.request('/api/posts/p1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('updates tiktok settings', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'pending', platform: 'tiktok' });
    mockUpdatePostTiktokSettings.mockResolvedValue({
      id: 'p1',
      tiktokSettings: '{"privacyLevel":"SELF_ONLY","consentConfirmed":true}',
    });
    const app = createApp();
    const res = await app.request('/api/posts/p1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    });
    expect(res.status).toBe(200);
    expect(mockUpdatePostTiktokSettings).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ privacyLevel: 'SELF_ONLY' })
    );
  });
});

describe('POST /api/posts/:id/publish', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for missing post', async () => {
    mockGetPost.mockResolvedValue(undefined);
    const app = createApp();
    const res = await app.request('/api/posts/nope/publish', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when post is not approved', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'pending' });
    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when platform not connected', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'approved', platform: 'twitter' });
    mockGetSocialConnection.mockResolvedValue(undefined);
    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('not connected');
  });

  it('publishes successfully and updates status to posted', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'approved', platform: 'twitter', content: 'Hello!' });
    mockGetSocialConnection.mockResolvedValue({ accessToken: 'enc:real-token', tokenExpiresAt: null });
    mockPublish.mockResolvedValue({ success: true, platformPostId: 'tw-999' });
    mockUpdatePostStatus.mockResolvedValue({ id: 'p1', status: 'posted' });

    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('posted');
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Hello!',
        accessToken: 'real-token',
        postId: 'p1',
      })
    );
    expect(mockUpdatePostStatus).toHaveBeenCalledWith('p1', 'posted');
  });

  it('returns 429 on rate limit', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'approved', platform: 'twitter', content: 'Hi' });
    mockGetSocialConnection.mockResolvedValue({ accessToken: 'enc:token', tokenExpiresAt: null });
    mockPublish.mockResolvedValue({ success: false, error: 'Rate limit exceeded' });

    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });
    expect(res.status).toBe(429);
  });

  it('returns 401 on expired token', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'approved', platform: 'twitter', content: 'Hi' });
    mockGetSocialConnection.mockResolvedValue({ accessToken: 'enc:token', tokenExpiresAt: null });
    mockPublish.mockResolvedValue({ success: false, error: 'expired token — please reconnect' });

    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 500 on generic failure', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'approved', platform: 'twitter', content: 'Hi' });
    mockGetSocialConnection.mockResolvedValue({ accessToken: 'enc:token', tokenExpiresAt: null });
    mockPublish.mockResolvedValue({ success: false, error: 'Something broke' });

    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });
    expect(res.status).toBe(500);
  });

  it('proactively refreshes token when expired and publishes successfully', async () => {
    const expiredAt = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'approved', platform: 'twitter', content: 'Hello!' });
    mockGetSocialConnection.mockResolvedValue({
      accessToken: 'enc:old-token',
      refreshToken: 'enc:refresh-tok',
      tokenExpiresAt: expiredAt,
    });
    mockRefreshAccessToken.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 7200,
    });
    mockUpdateSocialTokens.mockResolvedValue({});
    mockPublish.mockResolvedValue({ success: true, platformPostId: 'tw-111' });
    mockUpdatePostStatus.mockResolvedValue({ id: 'p1', status: 'posted' });

    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('twitter', 'refresh-tok');
    expect(mockUpdateSocialTokens).toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Hello!',
        accessToken: 'new-access',
      })
    );
  });

  it('retries with refreshed token on publish 401', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'approved', platform: 'twitter', content: 'Hello!' });
    mockGetSocialConnection.mockResolvedValue({
      accessToken: 'enc:old-token',
      refreshToken: 'enc:refresh-tok',
      tokenExpiresAt: null, // not expired by time, but will fail at publish
    });
    mockPublish
      .mockResolvedValueOnce({ success: false, error: 'expired token — please reconnect' })
      .mockResolvedValueOnce({ success: true, platformPostId: 'tw-222' });
    mockRefreshAccessToken.mockResolvedValue({
      accessToken: 'refreshed-access',
      refreshToken: 'refreshed-refresh',
      expiresIn: 7200,
    });
    mockUpdateSocialTokens.mockResolvedValue({});
    mockUpdatePostStatus.mockResolvedValue({ id: 'p1', status: 'posted' });

    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('twitter', 'refresh-tok');
    expect(mockPublish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: 'Hello!',
        accessToken: 'refreshed-access',
      })
    );
  });

  it('returns 401 when refresh fails', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'approved', platform: 'twitter', content: 'Hi' });
    mockGetSocialConnection.mockResolvedValue({
      accessToken: 'enc:old-token',
      refreshToken: 'enc:refresh-tok',
      tokenExpiresAt: null,
    });
    mockPublish.mockResolvedValue({ success: false, error: 'expired token — please reconnect' });
    mockRefreshAccessToken.mockRejectedValue(new Error('Twitter token refresh failed'));

    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('reconnect');
  });

  it('returns 401 when no refresh token available', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'approved', platform: 'twitter', content: 'Hi' });
    mockGetSocialConnection.mockResolvedValue({
      accessToken: 'enc:old-token',
      refreshToken: null,
      tokenExpiresAt: null,
    });
    mockPublish.mockResolvedValue({ success: false, error: 'expired token — please reconnect' });
    mockRefreshAccessToken.mockRejectedValue(new Error('No refresh token available'));

    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('starts a TikTok publish and stores async platform state', async () => {
    mockGetPost.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      status: 'approved',
      platform: 'tiktok',
      content: 'Watch this',
      mediaUrls: '["https://cdn.example.com/video.mp4"]',
      tiktokSettings:
        '{"privacyLevel":"SELF_ONLY","allowComment":true,"allowDuet":true,"allowStitch":true,"videoCoverTimestampMs":null,"brandContentToggle":false,"brandOrganicToggle":false,"isAigc":true,"consentConfirmed":true}',
      tiktokState:
        '{"creatorInfo":{"creatorUsername":"creator","creatorNickname":"Creator","creatorAvatarUrl":"https://avatar.test","privacyLevelOptions":["SELF_ONLY"],"commentDisabled":false,"duetDisabled":false,"stitchDisabled":false,"maxVideoPostDurationSec":600,"canPost":true,"fetchedAt":"2026-03-17T10:00:00Z"},"publishId":null,"publishStatus":null,"failReason":null,"proxy":null}',
    });
    mockGetSocialConnection.mockResolvedValue({ accessToken: 'enc:tt-token', tokenExpiresAt: null });
    mockVerifyTiktokProxyEgress.mockResolvedValue({
      provider: 'evomi',
      country: 'US',
      sessionId: 'sess-1',
      exitIp: '1.2.3.4',
      verifiedAt: '2026-03-17T10:00:00Z',
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'video/mp4' },
      arrayBuffer: async () => Buffer.from('video'),
    }) as any;
    mockGetVideoDurationSeconds.mockResolvedValue(42);
    mockPublish.mockResolvedValue({
      success: true,
      state: 'publishing',
      platformPublishId: 'pub-123',
      platformStatus: 'PROCESSING_UPLOAD',
      tiktokState: {
        creatorInfo: {
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
        },
        publishId: 'pub-123',
        publishStatus: 'PROCESSING_UPLOAD',
        failReason: null,
        proxy: null,
      },
    });
    mockUpdatePostPlatformState.mockResolvedValue({ id: 'p1', status: 'publishing' });

    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });

    expect(res.status).toBe(200);
    expect(mockVerifyTiktokProxyEgress).toHaveBeenCalled();
    expect(mockUpdatePostPlatformState).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        status: 'publishing',
        platformPublishId: 'pub-123',
        platformPublishStatus: 'PROCESSING_UPLOAD',
      })
    );
  });
});

describe('POST /api/posts/:id/refresh-status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('syncs TikTok publish status to posted', async () => {
    mockGetPost.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      platform: 'tiktok',
      platformPublishId: 'pub-123',
      platformPublishStatus: 'PROCESSING_UPLOAD',
      tiktokState:
        '{"creatorInfo":{"creatorUsername":"creator","creatorNickname":"Creator","creatorAvatarUrl":"https://avatar.test","privacyLevelOptions":["SELF_ONLY"],"commentDisabled":false,"duetDisabled":false,"stitchDisabled":false,"maxVideoPostDurationSec":600,"canPost":true,"fetchedAt":"2026-03-17T10:00:00Z"},"publishId":"pub-123","publishStatus":"PROCESSING_UPLOAD","failReason":null,"proxy":null}',
      userId: 'u1',
    });
    mockGetSocialConnection.mockResolvedValue({ accessToken: 'enc:tt-token' });
    mockVerifyTiktokProxyEgress.mockResolvedValue({
      provider: 'evomi',
      country: 'US',
      sessionId: 'sess-2',
      exitIp: '1.2.3.4',
      verifiedAt: '2026-03-17T10:00:00Z',
    });
    mockSyncStatus.mockResolvedValue({
      success: true,
      state: 'posted',
      platformPostId: 'video-123',
      platformPublishId: 'pub-123',
      platformStatus: 'PUBLISH_COMPLETE',
    });
    mockUpdatePostPlatformState.mockResolvedValue({ id: 'p1', status: 'posted' });

    const app = createApp();
    const res = await app.request('/api/posts/p1/refresh-status', { method: 'POST' });

    expect(res.status).toBe(200);
    expect(mockSyncStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'tt-token',
        platformPublishId: 'pub-123',
      })
    );
    expect(mockUpdatePostPlatformState).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        status: 'posted',
        platformPostId: 'video-123',
        platformPublishStatus: 'PUBLISH_COMPLETE',
      })
    );
  });
});

describe('POST /api/posts/:id/archive', () => {
  beforeEach(() => vi.clearAllMocks());

  it('archives a pending post', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'pending' });
    mockUpdatePostStatus.mockResolvedValue({ id: 'p1', status: 'archived' });
    const app = createApp();
    const res = await app.request('/api/posts/p1/archive', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockUpdatePostStatus).toHaveBeenCalledWith('p1', 'archived');
  });

  it('rejects archiving a published post', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'posted' });
    const app = createApp();
    const res = await app.request('/api/posts/p1/archive', { method: 'POST' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/posts/:id/restore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restores an archived post to pending', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'archived' });
    mockUpdatePostStatus.mockResolvedValue({ id: 'p1', status: 'pending' });
    const app = createApp();
    const res = await app.request('/api/posts/p1/restore', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockUpdatePostStatus).toHaveBeenCalledWith('p1', 'pending');
  });

  it('restores a rejected post to pending', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'rejected' });
    mockUpdatePostStatus.mockResolvedValue({ id: 'p1', status: 'pending' });
    const app = createApp();
    const res = await app.request('/api/posts/p1/restore', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('rejects restoring a posted post', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'posted' });
    const app = createApp();
    const res = await app.request('/api/posts/p1/restore', { method: 'POST' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/posts/:id/duplicate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('duplicates a post', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'posted', content: 'Hello', platform: 'twitter' });
    mockDuplicatePost.mockResolvedValue({ id: 'p2', status: 'pending', content: 'Hello', platform: 'twitter' });
    const app = createApp();
    const res = await app.request('/api/posts/p1/duplicate', { method: 'POST' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('pending');
  });
});
