import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createHmac } from 'node:crypto';

vi.mock('../../env.js', () => ({
  env: {
    githubWebhookSecret: 'test-webhook-secret',
    encryptionKey: 'a'.repeat(64),
    appBaseUrl: 'https://test.example.com',
  },
}));

const mockVerifyWebhookSignature = vi.fn();
vi.mock('../../lib/webhook-verify/webhook-verify.js', () => ({
  verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
}));

const mockFindWatchedRepoByName = vi.fn();
const mockGetConnection = vi.fn();
vi.mock('../../db/github/github.js', () => ({
  findWatchedRepoByName: (...args: unknown[]) => mockFindWatchedRepoByName(...args),
  getConnection: (...args: unknown[]) => mockGetConnection(...args),
}));

const mockDecrypt = vi.fn().mockReturnValue('ghp_token');
vi.mock('../../lib/crypto/crypto.js', () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

const mockGeneratePostDrafts = vi.fn();
vi.mock('../../lib/ai/ai.js', () => ({
  generatePostDrafts: (...args: unknown[]) => mockGeneratePostDrafts(...args),
}));

const mockCreatePost = vi.fn();
vi.mock('../../db/posts/posts.js', () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
}));

const mockCreateWebhookLog = vi.fn().mockResolvedValue({});
vi.mock('../../db/webhook-logs/webhook-logs.js', () => ({
  createWebhookLog: (...args: unknown[]) => mockCreateWebhookLog(...args),
}));

// Mock octokit for fetching diff
const mockGet = vi.fn();
vi.mock('octokit', () => ({
  Octokit: class {
    rest = {
      pulls: { get: mockGet },
    };
  },
}));

import { webhooks } from './webhooks.js';

function createApp() {
  const app = new Hono();
  app.route('/api/webhooks', webhooks);
  return app;
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    action: 'closed',
    pull_request: {
      merged: true,
      number: 42,
      title: 'Add feature X',
      body: 'Implements feature X',
      base: { repo: { full_name: 'user/repo' } },
    },
    ...overrides,
  });
}

describe('POST /api/webhooks/github', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when signature is invalid', async () => {
    mockVerifyWebhookSignature.mockReturnValue(false);
    const app = createApp();
    const res = await app.request('/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=bad',
      },
      body: makePayload(),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 and ignores non-PR events', async () => {
    mockVerifyWebhookSignature.mockReturnValue(true);
    const app = createApp();
    const res = await app.request('/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=test',
        'x-github-event': 'push',
      },
      body: JSON.stringify({ action: 'push' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: true });
  });

  it('returns 200 and ignores non-merged PRs', async () => {
    mockVerifyWebhookSignature.mockReturnValue(true);
    const app = createApp();
    const payload = makePayload({
      pull_request: {
        merged: false,
        number: 42,
        title: 'WIP',
        body: '',
        base: { repo: { full_name: 'user/repo' } },
      },
    });
    const res = await app.request('/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=test',
        'x-github-event': 'pull_request',
      },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: true });
  });

  it('returns 404 when repo is not watched', async () => {
    mockVerifyWebhookSignature.mockReturnValue(true);
    mockFindWatchedRepoByName.mockResolvedValue(undefined);
    const app = createApp();
    const res = await app.request('/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=test',
        'x-github-event': 'pull_request',
      },
      body: makePayload(),
    });
    expect(res.status).toBe(404);
  });

  it('generates drafts and creates 3 posts on merged PR', async () => {
    mockVerifyWebhookSignature.mockReturnValue(true);
    mockFindWatchedRepoByName.mockResolvedValue({ userId: 'u1', repoFullName: 'user/repo' });
    mockGetConnection.mockResolvedValue({ personalAccessToken: 'encrypted' });
    mockGet.mockResolvedValue({ data: { diff_url: 'https://patch' } });
    mockGeneratePostDrafts.mockResolvedValue({
      twitter: 'Tweet about feature X',
      linkedin: 'LinkedIn post about feature X',
      tiktok: 'TikTok caption about feature X',
    });
    mockCreatePost.mockResolvedValue({});

    const app = createApp();
    const res = await app.request('/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=test',
        'x-github-event': 'pull_request',
      },
      body: makePayload(),
    });
    expect(res.status).toBe(201);
    expect(mockCreatePost).toHaveBeenCalledTimes(3);

    // Check twitter post
    const twitterCall = mockCreatePost.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).platform === 'twitter'
    );
    expect(twitterCall).toBeDefined();
    expect((twitterCall![0] as Record<string, unknown>).content).toBe('Tweet about feature X');
    expect((twitterCall![0] as Record<string, unknown>).status).toBe('pending');

    // Check linkedin post
    const linkedinCall = mockCreatePost.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).platform === 'linkedin'
    );
    expect(linkedinCall).toBeDefined();

    const tiktokCall = mockCreatePost.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).platform === 'tiktok'
    );
    expect(tiktokCall).toBeDefined();
    expect((tiktokCall![0] as Record<string, unknown>).content).toBe('TikTok caption about feature X');
  });
});
