import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../../test/db-helper.js';
import { users } from '../schema.js';

let testDb: ReturnType<typeof createTestDb>;

vi.mock('../client/client.js', () => ({
  get db() {
    return testDb;
  },
}));

import {
  createPost,
  getPost,
  listPosts,
  updatePostStatus,
  updatePostContent,
  updatePostMediaUrls,
  updatePostTiktokSettings,
  updatePostPlatformState,
  duplicatePost,
} from './posts.js';

async function seedUser(id = 'u1') {
  await testDb.insert(users).values({ id, email: 'test@test.com', passwordHash: 'hash' });
}

describe('db/posts', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await seedUser();
  });

  describe('createPost', () => {
    it('inserts a post and returns it', async () => {
      const post = await createPost({
        id: 'p1',
        userId: 'u1',
        repoFullName: 'user/repo',
        prNumber: 42,
        prTitle: 'Add feature',
        prDescription: 'Description here',
        platform: 'twitter',
        content: 'Just shipped!',
        status: 'pending',
      });
      expect(post.id).toBe('p1');
      expect(post.platform).toBe('twitter');
      expect(post.status).toBe('pending');
      expect(post.prNumber).toBe(42);
    });

    it('supports tiktok publishing metadata', async () => {
      const post = await createPost({
        id: 'p-tiktok',
        userId: 'u1',
        repoFullName: 'user/repo',
        prNumber: 7,
        prTitle: 'Ship video flow',
        prDescription: 'Adds a video flow',
        platform: 'tiktok',
        content: 'Watch this ship',
        status: 'publishing',
        mediaUrls: JSON.stringify(['https://cdn.example.com/video.mp4']),
        tiktokSettings: JSON.stringify({ privacyLevel: 'SELF_ONLY', consentConfirmed: true }),
        tiktokState: JSON.stringify({ publishId: 'pub-1', publishStatus: 'PROCESSING_UPLOAD' }),
        platformPublishId: 'pub-1',
        platformPublishStatus: 'PROCESSING_UPLOAD',
        lastPlatformSyncAt: '2026-03-17T10:00:00Z',
      });

      expect(post.platform).toBe('tiktok');
      expect(post.status).toBe('publishing');
      expect(post.platformPublishId).toBe('pub-1');
      expect(post.platformPublishStatus).toBe('PROCESSING_UPLOAD');
    });
  });

  describe('getPost', () => {
    it('returns the post by id', async () => {
      await createPost({
        id: 'p1',
        userId: 'u1',
        repoFullName: 'user/repo',
        prNumber: 1,
        prTitle: 'Title',
        platform: 'twitter',
        content: 'tweet',
        status: 'pending',
      });
      const post = await getPost('p1');
      expect(post).toBeDefined();
      expect(post!.id).toBe('p1');
    });

    it('returns undefined for non-existent id', async () => {
      expect(await getPost('nope')).toBeUndefined();
    });
  });

  describe('listPosts', () => {
    it('returns empty when no posts', async () => {
      expect(await listPosts('u1')).toEqual([]);
    });

    it('returns all posts for the user', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'twitter', content: 'c', status: 'pending' });
      await createPost({ id: 'p2', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'linkedin', content: 'c', status: 'pending' });
      const posts = await listPosts('u1');
      expect(posts).toHaveLength(2);
    });

    it('filters by status', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'twitter', content: 'c', status: 'pending' });
      await createPost({ id: 'p2', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'linkedin', content: 'c', status: 'approved' });
      const pending = await listPosts('u1', { status: 'pending' });
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('p1');
    });

    it('filters by platform', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'twitter', content: 'c', status: 'pending' });
      await createPost({ id: 'p2', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'linkedin', content: 'c', status: 'pending' });
      await createPost({ id: 'p3', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'tiktok', content: 'c', status: 'publishing' });
      const tiktok = await listPosts('u1', { platform: 'tiktok' });
      expect(tiktok).toHaveLength(1);
      expect(tiktok[0].platform).toBe('tiktok');
    });

    it('does not return other users posts', async () => {
      await testDb.insert(users).values({ id: 'u2', email: 'other@test.com', passwordHash: 'h' });
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'twitter', content: 'c', status: 'pending' });
      await createPost({ id: 'p2', userId: 'u2', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'twitter', content: 'c', status: 'pending' });
      expect(await listPosts('u1')).toHaveLength(1);
    });
  });

  describe('updatePostStatus', () => {
    it('updates the status', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'twitter', content: 'c', status: 'pending' });
      const updated = await updatePostStatus('p1', 'approved');
      expect(updated.status).toBe('approved');
    });

    it('sets postedAt when status is posted', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'twitter', content: 'c', status: 'approved' });
      const updated = await updatePostStatus('p1', 'posted');
      expect(updated.postedAt).toBeDefined();
    });
  });

  describe('updatePostContent', () => {
    it('updates the content', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'twitter', content: 'old', status: 'pending' });
      const updated = await updatePostContent('p1', 'new content');
      expect(updated.content).toBe('new content');
    });
  });

  describe('updatePostMediaUrls', () => {
    it('updates mediaUrls', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'tiktok', content: 'c', status: 'pending' });
      const updated = await updatePostMediaUrls('p1', ['https://cdn.example.com/video.mp4']);
      expect(updated.mediaUrls).toBe(JSON.stringify(['https://cdn.example.com/video.mp4']));
    });
  });

  describe('updatePostTiktokSettings', () => {
    it('stores serialized tiktok settings', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'tiktok', content: 'c', status: 'pending' });
      const updated = await updatePostTiktokSettings('p1', {
        privacyLevel: 'SELF_ONLY',
        allowComment: true,
        allowDuet: false,
        allowStitch: false,
        videoCoverTimestampMs: null,
        brandContentToggle: false,
        brandOrganicToggle: false,
        isAigc: true,
        consentConfirmed: true,
      });

      expect(updated.tiktokSettings).toContain('"privacyLevel":"SELF_ONLY"');
      expect(updated.tiktokSettings).toContain('"consentConfirmed":true');
    });
  });

  describe('updatePostPlatformState', () => {
    it('stores platform publish metadata', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'tiktok', content: 'c', status: 'pending' });
      const updated = await updatePostPlatformState('p1', {
        status: 'publishing',
        platformPostId: null,
        platformPublishId: 'pub-123',
        platformPublishStatus: 'PROCESSING_UPLOAD',
        platformPublishError: null,
        lastPlatformSyncAt: '2026-03-17T12:00:00Z',
        tiktokState: { publishId: 'pub-123', publishStatus: 'PROCESSING_UPLOAD' },
      });

      expect(updated.status).toBe('publishing');
      expect(updated.platformPublishId).toBe('pub-123');
      expect(updated.platformPublishStatus).toBe('PROCESSING_UPLOAD');
      expect(updated.tiktokState).toContain('"publishId":"pub-123"');
    });
  });

  describe('listPosts excludes archived', () => {
    it('excludes archived posts by default', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'twitter', content: 'c', status: 'pending' });
      await createPost({ id: 'p2', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'twitter', content: 'c', status: 'archived' });
      const result = await listPosts('u1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
    });

    it('returns archived posts when explicitly filtered', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'r', prNumber: 1, prTitle: 't', platform: 'twitter', content: 'c', status: 'archived' });
      const result = await listPosts('u1', { status: 'archived' });
      expect(result).toHaveLength(1);
    });
  });

  describe('duplicatePost', () => {
    it('creates a copy with pending status', async () => {
      await createPost({ id: 'p1', userId: 'u1', repoFullName: 'user/repo', prNumber: 42, prTitle: 'Original', platform: 'twitter', content: 'Hello!', status: 'posted' });
      const copy = await duplicatePost('p1');
      expect(copy.id).not.toBe('p1');
      expect(copy.content).toBe('Hello!');
      expect(copy.platform).toBe('twitter');
      expect(copy.status).toBe('pending');
      expect(copy.prTitle).toBe('Original');
    });
  });
});
