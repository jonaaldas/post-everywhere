import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../../test/db-helper.js';

let testDb: ReturnType<typeof createTestDb>;

vi.mock('../client/client.js', () => ({
  get db() {
    return testDb;
  },
}));

import { createWebhookLog, listWebhookLogs } from './webhook-logs.js';

describe('db/webhook-logs', () => {
  beforeEach(() => {
    testDb = createTestDb();
  });

  describe('createWebhookLog', () => {
    it('inserts a log and returns it', async () => {
      const log = await createWebhookLog({
        id: 'wl1',
        eventType: 'pull_request',
        source: 'github',
        requestHeaders: '{"x-github-event":"pull_request"}',
        requestBody: '{"action":"closed"}',
        responseBody: '{"ok":true}',
        statusCode: 200,
      });
      expect(log.id).toBe('wl1');
      expect(log.eventType).toBe('pull_request');
      expect(log.source).toBe('github');
      expect(log.statusCode).toBe(200);
      expect(log.createdAt).toBeDefined();
    });
  });

  describe('listWebhookLogs', () => {
    it('returns logs newest first', async () => {
      await createWebhookLog({
        id: 'wl1',
        eventType: 'pull_request',
        source: 'github',
        requestHeaders: '{}',
        requestBody: '{}',
        responseBody: '{}',
        statusCode: 200,
        createdAt: '2024-01-01T00:00:00Z',
      });
      await createWebhookLog({
        id: 'wl2',
        eventType: 'push',
        source: 'github',
        requestHeaders: '{}',
        requestBody: '{}',
        responseBody: '{}',
        statusCode: 201,
        createdAt: '2024-01-02T00:00:00Z',
      });

      const logs = await listWebhookLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].id).toBe('wl2');
      expect(logs[1].id).toBe('wl1');
    });

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await createWebhookLog({
          id: `wl${i}`,
          eventType: 'push',
          source: 'github',
          requestHeaders: '{}',
          requestBody: '{}',
          responseBody: '{}',
          statusCode: 200,
        });
      }

      const logs = await listWebhookLogs(3);
      expect(logs).toHaveLength(3);
    });
  });
});
