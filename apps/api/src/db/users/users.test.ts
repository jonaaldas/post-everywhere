import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../../test/db-helper.js';

let testDb: ReturnType<typeof createTestDb>;

vi.mock('../client/client.js', () => ({
  get db() {
    return testDb;
  },
}));

import { createUser, findByEmail, countUsers } from './users.js';

describe('db/users', () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  describe('createUser', () => {
    it('inserts a user and returns it', async () => {
      const user = await createUser('u1', 'alice@test.com', 'hash123');
      expect(user.id).toBe('u1');
      expect(user.email).toBe('alice@test.com');
      expect(user.passwordHash).toBe('hash123');
      expect(user.createdAt).toBeDefined();
    });

    it('throws on duplicate email', async () => {
      await createUser('u1', 'alice@test.com', 'hash123');
      await expect(createUser('u2', 'alice@test.com', 'hash456')).rejects.toThrow();
    });

    it('throws on duplicate id', async () => {
      await createUser('u1', 'alice@test.com', 'hash123');
      await expect(createUser('u1', 'bob@test.com', 'hash456')).rejects.toThrow();
    });
  });

  describe('findByEmail', () => {
    it('returns the user when found', async () => {
      await createUser('u1', 'alice@test.com', 'hash123');
      const user = await findByEmail('alice@test.com');
      expect(user).toBeDefined();
      expect(user!.id).toBe('u1');
    });

    it('returns undefined when not found', async () => {
      const user = await findByEmail('nobody@test.com');
      expect(user).toBeUndefined();
    });
  });

  describe('countUsers', () => {
    it('returns 0 when no users', async () => {
      expect(await countUsers()).toBe(0);
    });

    it('returns 1 when one user exists', async () => {
      await createUser('u1', 'alice@test.com', 'hash123');
      expect(await countUsers()).toBe(1);
    });

    it('still returns 1 with multiple users (limit 1)', async () => {
      await createUser('u1', 'a@test.com', 'h1');
      await createUser('u2', 'b@test.com', 'h2');
      // countUsers uses limit(1), so it returns 1 not 2
      expect(await countUsers()).toBe(1);
    });
  });
});
