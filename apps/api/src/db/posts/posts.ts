import { randomUUID } from 'node:crypto';
import { and, desc, eq, notInArray } from 'drizzle-orm';

import { db } from '../client/client.js';
import { posts, type Post, type NewPost } from '../schema.js';
import type { TiktokSettings, TiktokState } from '../../lib/tiktok/types.js';

export async function createPost(data: NewPost): Promise<Post> {
  const [row] = await db.insert(posts).values(data).returning();
  return row;
}

export async function getPost(id: string): Promise<Post | undefined> {
  return db.select().from(posts).where(eq(posts.id, id)).get();
}

export async function listPosts(
  userId: string,
  filters?: { status?: string; platform?: string }
): Promise<Post[]> {
  const conditions = [eq(posts.userId, userId)];

  if (filters?.status) {
    conditions.push(eq(posts.status, filters.status as Post['status']));
  } else {
    // Exclude archived by default unless explicitly requested
    conditions.push(notInArray(posts.status, ['archived']));
  }
  if (filters?.platform) {
    conditions.push(eq(posts.platform, filters.platform as Post['platform']));
  }

  return db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt));
}

export async function updatePostStatus(id: string, status: Post['status']): Promise<Post> {
  const values: Partial<Post> = { status };
  if (status === 'posted') {
    values.postedAt = new Date().toISOString();
  }
  const [row] = await db.update(posts).set(values).where(eq(posts.id, id)).returning();
  return row;
}

export async function updatePostContent(id: string, content: string): Promise<Post> {
  const [row] = await db.update(posts).set({ content }).where(eq(posts.id, id)).returning();
  return row;
}

export async function updatePostMediaUrls(id: string, mediaUrls: string[]): Promise<Post> {
  const [row] = await db
    .update(posts)
    .set({ mediaUrls: JSON.stringify(mediaUrls) })
    .where(eq(posts.id, id))
    .returning();
  return row;
}

export async function updatePostTiktokSettings(id: string, settings: TiktokSettings): Promise<Post> {
  const [row] = await db
    .update(posts)
    .set({ tiktokSettings: JSON.stringify(settings) })
    .where(eq(posts.id, id))
    .returning();
  return row;
}

export async function updatePostPlatformState(
  id: string,
  data: {
    status?: Post['status'];
    platformPostId?: string | null;
    platformPublishId?: string | null;
    platformPublishStatus?: string | null;
    platformPublishError?: string | null;
    lastPlatformSyncAt?: string | null;
    tiktokState?: TiktokState;
  }
): Promise<Post> {
  const values: Partial<Post> = {
    platformPostId: data.platformPostId,
    platformPublishId: data.platformPublishId,
    platformPublishStatus: data.platformPublishStatus,
    platformPublishError: data.platformPublishError,
    lastPlatformSyncAt: data.lastPlatformSyncAt,
    tiktokState: data.tiktokState ? JSON.stringify(data.tiktokState) : undefined,
  };

  if (data.status) {
    values.status = data.status;
    if (data.status === 'posted') {
      values.postedAt = new Date().toISOString();
    }
  }

  const [row] = await db.update(posts).set(values).where(eq(posts.id, id)).returning();
  return row;
}

export async function duplicatePost(id: string): Promise<Post> {
  const original = await getPost(id);
  if (!original) throw new Error('Post not found');

  const [row] = await db
    .insert(posts)
    .values({
      id: randomUUID(),
      userId: original.userId,
      repoFullName: original.repoFullName,
      prNumber: original.prNumber,
      prTitle: original.prTitle,
      prDescription: original.prDescription,
      platform: original.platform,
      content: original.content,
      mediaUrls: original.mediaUrls,
      status: 'pending',
    })
    .returning();
  return row;
}
