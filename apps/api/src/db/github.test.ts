import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../test/db-helper.js';
import { users } from './schema.js';

let testDb: ReturnType<typeof createTestDb>;

vi.mock('./client.js', () => ({
  get db() {
    return testDb;
  },
}));

import {
  saveConnection,
  getConnection,
  addWatchedRepo,
  getWatchedRepo,
  listWatchedRepos,
  removeWatchedRepo,
  findWatchedRepoByName,
} from './github.js';

async function seedUser(id = 'u1', email = 'test@test.com') {
  await testDb.insert(users).values({ id, email, passwordHash: 'hash' });
}

describe('db/github — connections', () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  describe('saveConnection', () => {
    it('inserts a new connection', async () => {
      await seedUser();
      const conn = await saveConnection('c1', 'u1', 'enc-pat', 'octocat');
      expect(conn.id).toBe('c1');
      expect(conn.userId).toBe('u1');
      expect(conn.personalAccessToken).toBe('enc-pat');
      expect(conn.githubUsername).toBe('octocat');
    });

    it('upserts when connection already exists', async () => {
      await seedUser();
      await saveConnection('c1', 'u1', 'enc-pat-old', 'octocat');
      const updated = await saveConnection('c2', 'u1', 'enc-pat-new', 'newcat');
      expect(updated.personalAccessToken).toBe('enc-pat-new');
      expect(updated.githubUsername).toBe('newcat');
      // Should not create a second row — still the original id
      expect(updated.id).toBe('c1');
    });
  });

  describe('getConnection', () => {
    it('returns undefined when none exists', async () => {
      expect(await getConnection('u1')).toBeUndefined();
    });

    it('returns the connection for the user', async () => {
      await seedUser();
      await saveConnection('c1', 'u1', 'enc-pat', 'octocat');
      const conn = await getConnection('u1');
      expect(conn).toBeDefined();
      expect(conn!.githubUsername).toBe('octocat');
    });
  });
});

describe('db/github — watched repos', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    await seedUser();
  });

  describe('addWatchedRepo', () => {
    it('inserts a watched repo', async () => {
      const repo = await addWatchedRepo('wr1', 'u1', 'user/repo', 'wh-1');
      expect(repo.id).toBe('wr1');
      expect(repo.repoFullName).toBe('user/repo');
      expect(repo.webhookId).toBe('wh-1');
      expect(repo.active).toBe(1);
    });
  });

  describe('getWatchedRepo', () => {
    it('returns undefined when not watching', async () => {
      expect(await getWatchedRepo('u1', 'user/repo')).toBeUndefined();
    });

    it('returns the repo when watching', async () => {
      await addWatchedRepo('wr1', 'u1', 'user/repo', 'wh-1');
      const repo = await getWatchedRepo('u1', 'user/repo');
      expect(repo).toBeDefined();
      expect(repo!.webhookId).toBe('wh-1');
    });

    it('scopes by userId', async () => {
      await seedUser('u2', 'other@test.com');
      await addWatchedRepo('wr1', 'u1', 'user/repo', 'wh-1');
      expect(await getWatchedRepo('u2', 'user/repo')).toBeUndefined();
    });
  });

  describe('listWatchedRepos', () => {
    it('returns empty array when none', async () => {
      expect(await listWatchedRepos('u1')).toEqual([]);
    });

    it('returns all repos for the user', async () => {
      await addWatchedRepo('wr1', 'u1', 'user/repo-a', 'wh-1');
      await addWatchedRepo('wr2', 'u1', 'user/repo-b', 'wh-2');
      const repos = await listWatchedRepos('u1');
      expect(repos).toHaveLength(2);
    });

    it('does not include other users repos', async () => {
      await seedUser('u2', 'other@test.com');
      await addWatchedRepo('wr1', 'u1', 'user/repo-a', 'wh-1');
      await addWatchedRepo('wr2', 'u2', 'user/repo-b', 'wh-2');
      expect(await listWatchedRepos('u1')).toHaveLength(1);
    });
  });

  describe('removeWatchedRepo', () => {
    it('removes the repo', async () => {
      await addWatchedRepo('wr1', 'u1', 'user/repo', 'wh-1');
      await removeWatchedRepo('u1', 'user/repo');
      expect(await getWatchedRepo('u1', 'user/repo')).toBeUndefined();
    });

    it('does nothing when repo not found', async () => {
      // Should not throw
      await removeWatchedRepo('u1', 'nonexistent/repo');
    });
  });

  describe('findWatchedRepoByName', () => {
    it('returns the active repo regardless of user', async () => {
      await addWatchedRepo('wr1', 'u1', 'user/repo', 'wh-1');
      const repo = await findWatchedRepoByName('user/repo');
      expect(repo).toBeDefined();
      expect(repo!.id).toBe('wr1');
    });

    it('returns undefined for non-existent repo', async () => {
      expect(await findWatchedRepoByName('nope/nope')).toBeUndefined();
    });
  });
});
