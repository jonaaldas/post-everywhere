import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const channelStates = ['ready', 'staged', 'paused'] as const;

export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  reach: text('reach').notNull(),
  state: text('state', { enum: channelStates }).notNull().default('staged'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;

// --- Phase 1: Auth ---

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// --- Phase 2: GitHub ---

export const githubConnections = sqliteTable('github_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  personalAccessToken: text('personal_access_token').notNull(), // encrypted
  githubUsername: text('github_username').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type GithubConnection = typeof githubConnections.$inferSelect;

export const watchedRepos = sqliteTable('watched_repos', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  repoFullName: text('repo_full_name').notNull(),
  webhookId: text('webhook_id'),
  active: integer('active').notNull().default(1),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type WatchedRepo = typeof watchedRepos.$inferSelect;

// --- Phase 3: Posts ---

export const postPlatforms = ['twitter', 'linkedin'] as const;
export const postStatuses = ['pending', 'approved', 'posted', 'rejected', 'archived'] as const;

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  repoFullName: text('repo_full_name').notNull(),
  prNumber: integer('pr_number').notNull(),
  prTitle: text('pr_title').notNull(),
  prDescription: text('pr_description'),
  platform: text('platform', { enum: postPlatforms }).notNull(),
  content: text('content').notNull(),
  status: text('status', { enum: postStatuses }).notNull().default('pending'),
  postedAt: text('posted_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

// --- Phase 4: Social Connections ---

export const socialPlatforms = ['twitter', 'linkedin'] as const;

export const socialConnections = sqliteTable('social_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  platform: text('platform', { enum: socialPlatforms }).notNull(),
  accessToken: text('access_token').notNull(), // encrypted
  refreshToken: text('refresh_token'), // encrypted, nullable
  platformUserId: text('platform_user_id').notNull(),
  platformUsername: text('platform_username').notNull(),
  tokenExpiresAt: text('token_expires_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type SocialConnection = typeof socialConnections.$inferSelect;
export type NewSocialConnection = typeof socialConnections.$inferInsert;

// --- Webhook Logs ---

export const webhookLogs = sqliteTable('webhook_logs', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  source: text('source').notNull(),
  requestHeaders: text('request_headers').notNull(),
  requestBody: text('request_body').notNull(),
  responseBody: text('response_body').notNull(),
  statusCode: integer('status_code').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
