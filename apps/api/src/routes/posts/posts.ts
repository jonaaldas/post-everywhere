import { Hono } from 'hono';

import { listPosts, getPost, updatePostStatus, updatePostContent, updatePostMediaUrls, duplicatePost } from '../../db/posts/posts.js';
import { getSocialConnection, updateSocialTokens } from '../../db/social/social.js';
import { decrypt, encrypt } from '../../lib/crypto/crypto.js';
import { getPublisher } from '../../lib/publisher/index.js';
import { refreshAccessToken } from '../../lib/publisher/refresh.js';
import type { MediaItem } from '../../lib/publisher/types.js';

const posts = new Hono();

posts.get('/', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const status = c.req.query('status');
  const platform = c.req.query('platform');
  const result = await listPosts(userId, { status, platform });
  return c.json(result);
});

posts.get('/:id', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const post = await getPost(c.req.param('id'));

  if (!post) {
    return c.json({ error: 'post not found' }, 404);
  }
  if (post.userId !== userId) {
    return c.json({ error: 'forbidden' }, 403);
  }

  return c.json(post);
});

posts.patch('/:id', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const post = await getPost(c.req.param('id'));

  if (!post) {
    return c.json({ error: 'post not found' }, 404);
  }
  if (post.userId !== userId) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const body = await c.req.json<{ content?: string; status?: string; mediaUrls?: string[] }>();

  if (!body.content && !body.status && !body.mediaUrls) {
    return c.json({ error: 'content, status, or mediaUrls is required' }, 400);
  }

  let updated = post;
  if (body.content) {
    updated = await updatePostContent(post.id, body.content);
  }
  if (body.mediaUrls !== undefined) {
    updated = await updatePostMediaUrls(post.id, body.mediaUrls);
  }
  if (body.status) {
    updated = await updatePostStatus(post.id, body.status as typeof post.status);
  }

  return c.json(updated);
});

posts.post('/:id/archive', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const post = await getPost(c.req.param('id'));

  if (!post) return c.json({ error: 'post not found' }, 404);
  if (post.userId !== userId) return c.json({ error: 'forbidden' }, 403);
  if (post.status === 'posted') return c.json({ error: 'cannot archive a published post' }, 400);

  const updated = await updatePostStatus(post.id, 'archived');
  return c.json(updated);
});

posts.post('/:id/restore', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const post = await getPost(c.req.param('id'));

  if (!post) return c.json({ error: 'post not found' }, 404);
  if (post.userId !== userId) return c.json({ error: 'forbidden' }, 403);
  if (post.status !== 'archived' && post.status !== 'rejected') {
    return c.json({ error: 'only archived or rejected posts can be restored' }, 400);
  }

  const updated = await updatePostStatus(post.id, 'pending');
  return c.json(updated);
});

posts.post('/:id/duplicate', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const post = await getPost(c.req.param('id'));

  if (!post) return c.json({ error: 'post not found' }, 404);
  if (post.userId !== userId) return c.json({ error: 'forbidden' }, 403);

  const newPost = await duplicatePost(post.id);
  return c.json(newPost, 201);
});

posts.post('/:id/publish', async (c) => {
  const userId = (c.get('jwtPayload') as { sub: string }).sub;
  const post = await getPost(c.req.param('id'));

  if (!post) {
    return c.json({ error: 'post not found' }, 404);
  }
  if (post.userId !== userId) {
    return c.json({ error: 'forbidden' }, 403);
  }
  if (post.status !== 'approved') {
    return c.json({ error: 'post must be approved before publishing' }, 400);
  }

  const connection = await getSocialConnection(userId, post.platform);
  if (!connection) {
    return c.json({ error: `${post.platform} not connected` }, 400);
  }

  let accessToken = decrypt(connection.accessToken);
  const publisher = getPublisher(post.platform);

  // Proactively refresh if token is expired or within 5 minutes of expiry
  const REFRESH_BUFFER_MS = 5 * 60 * 1000;
  if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt).getTime() < Date.now() + REFRESH_BUFFER_MS) {
    try {
      const refreshToken = connection.refreshToken ? decrypt(connection.refreshToken) : null;
      const refreshed = await refreshAccessToken(post.platform, refreshToken);
      accessToken = refreshed.accessToken;
      await updateSocialTokens(userId, post.platform, {
        accessToken: encrypt(refreshed.accessToken),
        refreshToken: refreshed.refreshToken ? encrypt(refreshed.refreshToken) : undefined,
        tokenExpiresAt: refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() : null,
      });
    } catch {
      return c.json({ error: `${post.platform} token expired — please reconnect` }, 401);
    }
  }

  // Download media from R2 if post has media URLs
  let mediaItems: MediaItem[] | undefined;
  if (post.mediaUrls) {
    try {
      const urls: string[] = JSON.parse(post.mediaUrls);
      if (urls.length) {
        mediaItems = [];
        for (const url of urls) {
          const res = await fetch(url);
          if (!res.ok) continue;
          const buffer = Buffer.from(await res.arrayBuffer());
          const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
          const type = mimeType.startsWith('video/') ? 'video' : 'image';
          mediaItems.push({ url, buffer, mimeType, type });
        }
      }
    } catch {
      // If media download fails, publish text-only
      mediaItems = undefined;
    }
  }

  let result = await publisher.publish(post.content, accessToken, mediaItems);

  // On publish 401, attempt refresh once and retry
  if (
    !result.success &&
    (result.error?.toLowerCase().includes('expired') || result.error?.toLowerCase().includes('reconnect'))
  ) {
    try {
      const refreshToken = connection.refreshToken ? decrypt(connection.refreshToken) : null;
      const refreshed = await refreshAccessToken(post.platform, refreshToken);
      accessToken = refreshed.accessToken;
      await updateSocialTokens(userId, post.platform, {
        accessToken: encrypt(refreshed.accessToken),
        refreshToken: refreshed.refreshToken ? encrypt(refreshed.refreshToken) : undefined,
        tokenExpiresAt: refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() : null,
      });
      result = await publisher.publish(post.content, accessToken, mediaItems);
    } catch {
      return c.json({ error: `${post.platform} token expired — please reconnect` }, 401);
    }
  }

  if (!result.success) {
    if (result.error?.toLowerCase().includes('rate limit')) {
      return c.json({ error: result.error }, 429);
    }
    if (result.error?.toLowerCase().includes('expired') || result.error?.toLowerCase().includes('reconnect')) {
      return c.json({ error: result.error }, 401);
    }
    return c.json({ error: result.error ?? 'Publishing failed' }, 500);
  }

  const updated = await updatePostStatus(post.id, 'posted');
  return c.json(updated);
});

export { posts };
