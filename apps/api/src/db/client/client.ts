import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import { env } from '../../env.js';
import * as schema from '../schema.js';

export const client = createClient({
  url: env.tursoDatabaseUrl,
  authToken: env.tursoAuthToken,
});

export const db = drizzle(client, { schema });

export async function pingDatabase() {
  try {
    await client.execute('select 1');

    return {
      provider: 'turso' as const,
      connected: true,
    };
  } catch (error) {
    return {
      provider: 'turso' as const,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}
