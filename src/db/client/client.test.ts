import { describe, it, expect, vi } from 'vitest';

// Mock env so client.ts doesn't throw on missing env vars
vi.mock('../../env.js', () => ({
  env: {
    tursoDatabaseUrl: 'file::memory:',
    tursoAuthToken: 'fake-token',
  },
}));

// Must use vi.hoisted so the fn is available when vi.mock factory runs
const mockExecute = vi.hoisted(() => vi.fn());

vi.mock('@libsql/client', () => ({
  createClient: () => ({ execute: mockExecute }),
}));

import { pingDatabase } from './client.js';

describe('db/client', () => {
  describe('pingDatabase', () => {
    it('returns connected: true when DB is reachable', async () => {
      mockExecute.mockResolvedValue({});
      const result = await pingDatabase();
      expect(result).toEqual({ provider: 'turso', connected: true });
    });

    it('returns connected: false with error message on failure', async () => {
      mockExecute.mockRejectedValue(new Error('Connection refused'));
      const result = await pingDatabase();
      expect(result).toEqual({
        provider: 'turso',
        connected: false,
        error: 'Connection refused',
      });
    });

    it('returns generic error for non-Error throws', async () => {
      mockExecute.mockRejectedValue('something weird');
      const result = await pingDatabase();
      expect(result).toEqual({
        provider: 'turso',
        connected: false,
        error: 'Unknown database error',
      });
    });
  });
});
