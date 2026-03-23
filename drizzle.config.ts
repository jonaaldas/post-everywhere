import 'dotenv/config';

import { defineConfig } from 'drizzle-kit';

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: getRequiredEnv('TURSO_DATABASE_URL'),
    authToken: getRequiredEnv('TURSO_AUTH_TOKEN'),
  },
});
