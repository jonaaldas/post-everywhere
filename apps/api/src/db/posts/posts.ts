import { and, desc, eq } from 'drizzle-orm';

import { db } from '../client/client.js';
import { posts, type Post, type NewPost } from '../schema.js';

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
