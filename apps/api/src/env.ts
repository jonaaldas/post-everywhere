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
  port: parsePort(process.env.PORT),
  tursoDatabaseUrl: getRequiredEnv('TURSO_DATABASE_URL'),
  tursoAuthToken: getRequiredEnv('TURSO_AUTH_TOKEN'),
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  githubWebhookSecret: getRequiredEnv('GITHUB_WEBHOOK_SECRET'),
  encryptionKey: getRequiredEnv('ENCRYPTION_KEY'), // 32-byte hex string for AES-256-GCM
  appBaseUrl: getRequiredEnv('APP_BASE_URL'),
  anthropicApiKey: getRequiredEnv('ANTHROPIC_API_KEY'),
} as const;
