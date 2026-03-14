import { and, eq } from 'drizzle-orm';

import { db } from '../client/client.js';
import { githubConnections, watchedRepos, type GithubConnection, type WatchedRepo } from '../schema.js';

// --- GitHub Connections ---

export async function saveConnection(
  id: string,
  userId: string,
  encryptedPat: string,
  githubUsername: string
): Promise<GithubConnection> {
  // Upsert: one connection per user
  const existing = await getConnection(userId);
  if (existing) {
    await db
      .update(githubConnections)
      .set({ personalAccessToken: encryptedPat, githubUsername })
      .where(eq(githubConnections.userId, userId));
    return { ...existing, personalAccessToken: encryptedPat, githubUsername };
  }
  const [row] = await db
    .insert(githubConnections)
    .values({ id, userId, personalAccessToken: encryptedPat, githubUsername })
    .returning();
  return row;
}

export async function getConnection(userId: string): Promise<GithubConnection | undefined> {
  return db.select().from(githubConnections).where(eq(githubConnections.userId, userId)).get();
}

// --- Watched Repos ---

export async function addWatchedRepo(
  id: string,
  userId: string,
  repoFullName: string,
  webhookId: string
): Promise<WatchedRepo> {
  const [row] = await db
    .insert(watchedRepos)
    .values({ id, userId, repoFullName, webhookId, active: 1 })
    .returning();
  return row;
}

export async function getWatchedRepo(userId: string, repoFullName: string): Promise<WatchedRepo | undefined> {
  return db
    .select()
    .from(watchedRepos)
    .where(and(eq(watchedRepos.userId, userId), eq(watchedRepos.repoFullName, repoFullName)))
    .get();
}

export async function listWatchedRepos(userId: string): Promise<WatchedRepo[]> {
  return db.select().from(watchedRepos).where(eq(watchedRepos.userId, userId));
}

export async function removeWatchedRepo(userId: string, repoFullName: string): Promise<void> {
  await db
    .delete(watchedRepos)
    .where(and(eq(watchedRepos.userId, userId), eq(watchedRepos.repoFullName, repoFullName)));
}

export async function findWatchedRepoByName(repoFullName: string): Promise<WatchedRepo | undefined> {
  return db
    .select()
    .from(watchedRepos)
    .where(and(eq(watchedRepos.repoFullName, repoFullName), eq(watchedRepos.active, 1)))
    .get();
}
