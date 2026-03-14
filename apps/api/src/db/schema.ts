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
