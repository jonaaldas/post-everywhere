import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';

export function createTestDb() {
  const sqlite = new Database(':memory:');

  sqlite.exec(`
    CREATE TABLE channels (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      reach TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'staged',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE github_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      personal_access_token TEXT NOT NULL,
      github_username TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE watched_repos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      repo_full_name TEXT NOT NULL,
      webhook_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE social_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      platform TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      platform_user_id TEXT NOT NULL,
      platform_username TEXT NOT NULL,
      token_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      repo_full_name TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      pr_title TEXT NOT NULL,
      pr_description TEXT,
      platform TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      posted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);

  return drizzle(sqlite, { schema });
}
