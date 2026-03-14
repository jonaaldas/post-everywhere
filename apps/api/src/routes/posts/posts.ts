import { Hono } from 'hono';

import { listPosts, getPost, updatePostStatus, updatePostContent } from '../../db/posts/posts.js';
import { getSocialConnection } from '../../db/social/social.js';
import { decrypt } from '../../lib/crypto/crypto.js';
import { getPublisher } from '../../lib/publisher/index.js';

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

  const body = await c.req.json<{ content?: string; status?: string }>();

  if (!body.content && !body.status) {
    return c.json({ error: 'content or status is required' }, 400);
  }

  let updated = post;
  if (body.content) {
    updated = await updatePostContent(post.id, body.content);
  }
  if (body.status) {
    updated = await updatePostStatus(post.id, body.status as typeof post.status);
  }

  return c.json(updated);
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

  const accessToken = decrypt(connection.accessToken);
  const publisher = getPublisher(post.platform);
  const result = await publisher.publish(post.content, accessToken);

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
