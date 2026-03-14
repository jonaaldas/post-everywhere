import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../test/db-helper.js';

let testDb: ReturnType<typeof createTestDb>;

vi.mock('./client.js', () => ({
  get db() {
    return testDb;
  },
}));

import { listChannels } from './channels.js';

describe('db/channels', () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  describe('listChannels', () => {
    it('seeds default channels on first call', async () => {
      const channels = await listChannels();
      expect(channels).toHaveLength(3);
      expect(channels.map((c) => c.id)).toEqual(['web', 'email', 'social']);
    });

    it('does not duplicate on subsequent calls', async () => {
      await listChannels();
      const channels = await listChannels();
      expect(channels).toHaveLength(3);
    });

    it('returns channels sorted by sortOrder then label', async () => {
      const channels = await listChannels();
      expect(channels[0].sortOrder).toBeLessThanOrEqual(channels[1].sortOrder);
    });
  });
});
