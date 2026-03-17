import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';

import { db } from '../client/client.js';
import { socialConnections, type SocialConnection } from '../schema.js';

type Platform = SocialConnection['platform'];

interface SaveInput {
  userId: string;
  platform: Platform;
  accessToken: string;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: string | null;
  platformUserId: string;
  platformUsername: string;
  tokenExpiresAt?: string | null;
}

export async function saveSocialConnection(input: SaveInput): Promise<SocialConnection> {
  // Try to find existing
  const existing = await getSocialConnection(input.userId, input.platform);

  if (existing) {
    const [row] = await db
      .update(socialConnections)
      .set({
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? existing.refreshToken,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt ?? existing.refreshTokenExpiresAt,
        platformUserId: input.platformUserId,
        platformUsername: input.platformUsername,
        tokenExpiresAt: input.tokenExpiresAt ?? existing.tokenExpiresAt,
      })
      .where(eq(socialConnections.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(socialConnections)
    .values({
      id: randomUUID(),
      ...input,
    })
    .returning();
  return row;
}

export async function getSocialConnection(
  userId: string,
  platform: Platform
): Promise<SocialConnection | undefined> {
  return db
    .select()
    .from(socialConnections)
    .where(and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform)))
    .get();
}

export async function deleteSocialConnection(userId: string, platform: Platform): Promise<void> {
  await db
    .delete(socialConnections)
    .where(and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform)));
}

export async function updateSocialTokens(
  userId: string,
  platform: Platform,
  tokens: {
    accessToken: string;
    refreshToken?: string | null;
    refreshTokenExpiresAt?: string | null;
    tokenExpiresAt?: string | null;
  }
): Promise<SocialConnection> {
  const [row] = await db
    .update(socialConnections)
    .set(tokens)
    .where(and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform)))
    .returning();
  return row;
}
