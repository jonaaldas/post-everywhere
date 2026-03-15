const DEFAULT_PORT = 8787;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}

export const env = {
  nodeEnv: process.env.NODE_ENV?.trim() ?? 'development',
  port: parsePort(process.env.PORT),
  tursoDatabaseUrl: getRequiredEnv('TURSO_DATABASE_URL'),
  tursoAuthToken: getRequiredEnv('TURSO_AUTH_TOKEN'),
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  githubWebhookSecret: getRequiredEnv('GITHUB_WEBHOOK_SECRET'),
  encryptionKey: getRequiredEnv('ENCRYPTION_KEY'), // 32-byte hex string for AES-256-GCM
  appBaseUrl: getRequiredEnv('APP_BASE_URL'),
  openaiApiKey: getRequiredEnv('OPENAI_API_KEY'),
  // Phase 4: Social OAuth (optional — features disabled when absent)
  twitterClientId: process.env.TWITTER_CLIENT_ID?.trim() ?? '',
  twitterClientSecret: process.env.TWITTER_CLIENT_SECRET?.trim() ?? '',
  linkedinClientId: process.env.LINKEDIN_CLIENT_ID?.trim() ?? '',
  linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET?.trim() ?? '',
  redisUrl: process.env.REDIS_URL?.trim() ?? 'redis://localhost:6379',
} as const;
