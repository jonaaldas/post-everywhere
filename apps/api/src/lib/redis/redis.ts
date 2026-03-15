import { Redis } from 'ioredis';

import { env } from '../../env.js';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
  }
  return redis;
}

/** Cache a value with TTL in seconds. */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  const r = getRedis();
  await r.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

/** Get a cached value, returns null on miss. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  const raw = await r.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

/** Delete a cached key. */
export async function cacheDel(key: string) {
  const r = getRedis();
  await r.del(key);
}
