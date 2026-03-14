import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../env.js', () => ({
  env: { jwtSecret: 'test-secret-key' },
}));

const mockListPosts = vi.fn();
const mockGetPost = vi.fn();
const mockUpdatePostStatus = vi.fn();
const mockUpdatePostContent = vi.fn();

vi.mock('../../db/posts/posts.js', () => ({
  listPosts: (...args: unknown[]) => mockListPosts(...args),
  getPost: (...args: unknown[]) => mockGetPost(...args),
  updatePostStatus: (...args: unknown[]) => mockUpdatePostStatus(...args),
  updatePostContent: (...args: unknown[]) => mockUpdatePostContent(...args),
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

  it('returns 501 for now (publishing implemented in Phase 4)', async () => {
    mockGetPost.mockResolvedValue({ id: 'p1', userId: 'u1', status: 'approved', platform: 'twitter' });
    const app = createApp();
    const res = await app.request('/api/posts/p1/publish', { method: 'POST' });
    // Phase 3 stubs publish — will return 501 until Phase 4
    expect(res.status).toBe(501);
  });
});
