import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../../test/db-helper.js';
import { users, socialConnections } from '../schema.js';

let testDb: ReturnType<typeof createTestDb>;

vi.mock('../client/client.js', () => ({
  get db() {
    return testDb;
  },
}));

import {
  saveSocialConnection,
  getSocialConnection,
  deleteSocialConnection,
  updateSocialTokens,
} from './social.js';

async function seedUser(id = 'u1') {
  await testDb.insert(users).values({ id, email: 'test@test.com', passwordHash: 'hash' });
}

describe('db/social', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await seedUser();
  });

  describe('saveSocialConnection', () => {
    it('inserts a new connection', async () => {
      const conn = await saveSocialConnection({
        userId: 'u1',
        platform: 'twitter',
        accessToken: 'enc-access',
        refreshToken: 'enc-refresh',
        refreshTokenExpiresAt: '2026-08-01T00:00:00Z',
        platformUserId: 'tw-123',
        platformUsername: 'testuser',
        tokenExpiresAt: '2026-04-01T00:00:00Z',
      });

      expect(conn.userId).toBe('u1');
      expect(conn.platform).toBe('twitter');
      expect(conn.accessToken).toBe('enc-access');
      expect(conn.platformUsername).toBe('testuser');
      expect(conn.refreshTokenExpiresAt).toBe('2026-08-01T00:00:00Z');
    });

    it('upserts on same userId+platform', async () => {
      await saveSocialConnection({
        userId: 'u1',
        platform: 'twitter',
        accessToken: 'old-token',
        platformUserId: 'tw-123',
        platformUsername: 'testuser',
      });

      const updated = await saveSocialConnection({
        userId: 'u1',
        platform: 'twitter',
        accessToken: 'new-token',
        platformUserId: 'tw-123',
        platformUsername: 'newname',
      });

      expect(updated.accessToken).toBe('new-token');
      expect(updated.platformUsername).toBe('newname');

      const all = testDb.select().from(socialConnections).all();
      expect(all).toHaveLength(1);
    });
  });

  describe('getSocialConnection', () => {
    it('returns connection when found', async () => {
      await saveSocialConnection({
        userId: 'u1',
        platform: 'linkedin',
        accessToken: 'enc-token',
        platformUserId: 'li-456',
        platformUsername: 'linkeduser',
      });

      const conn = await getSocialConnection('u1', 'linkedin');
      expect(conn).toBeDefined();
      expect(conn!.platform).toBe('linkedin');
      expect(conn!.platformUsername).toBe('linkeduser');
    });

    it('returns undefined when not found', async () => {
      const conn = await getSocialConnection('u1', 'twitter');
      expect(conn).toBeUndefined();
    });
  });

  describe('deleteSocialConnection', () => {
    it('removes the connection', async () => {
      await saveSocialConnection({
        userId: 'u1',
        platform: 'twitter',
        accessToken: 'enc-token',
        platformUserId: 'tw-123',
        platformUsername: 'testuser',
      });

      await deleteSocialConnection('u1', 'twitter');
      const conn = await getSocialConnection('u1', 'twitter');
      expect(conn).toBeUndefined();
    });
  });

  describe('updateSocialTokens', () => {
    it('updates access and refresh tokens', async () => {
      await saveSocialConnection({
        userId: 'u1',
        platform: 'twitter',
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        refreshTokenExpiresAt: '2026-06-01T00:00:00Z',
        platformUserId: 'tw-123',
        platformUsername: 'testuser',
        tokenExpiresAt: '2026-03-01T00:00:00Z',
      });

      const updated = await updateSocialTokens('u1', 'twitter', {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        refreshTokenExpiresAt: '2026-09-01T00:00:00Z',
        tokenExpiresAt: '2026-05-01T00:00:00Z',
      });

      expect(updated.accessToken).toBe('new-access');
      expect(updated.refreshToken).toBe('new-refresh');
      expect(updated.refreshTokenExpiresAt).toBe('2026-09-01T00:00:00Z');
      expect(updated.tokenExpiresAt).toBe('2026-05-01T00:00:00Z');
    });
  });
});
