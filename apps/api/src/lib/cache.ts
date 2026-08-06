import { getRedis } from "./redis.js";

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

const memory = new Map<string, MemoryEntry>();

const KEY_PREFIX = "parallax:";

export const cacheKeys = {
  health: (repositoryId: string) => `${KEY_PREFIX}health:${repositoryId}`,
  analytics: (workspaceId: string, scope: string, range: string) =>
    `${KEY_PREFIX}analytics:${workspaceId}:${scope}:${range}`,
  repository: (repositoryId: string) => `${KEY_PREFIX}repository:${repositoryId}`,
  overview: (workspaceId: string) => `${KEY_PREFIX}overview:${workspaceId}`,
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return;
  }
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(key);
    return;
  }
  memory.delete(key);
}

export async function cacheDelPrefix(prefix: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    const keys = await redis.keys(`${KEY_PREFIX}${prefix}*`);
    if (keys.length) await redis.del(...keys);
    return;
  }
  for (const key of memory.keys()) {
    if (key.startsWith(`${KEY_PREFIX}${prefix}`)) memory.delete(key);
  }
}

/** Cache-aside helper with a fallible loader. */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const value = await loader();
  await cacheSet(key, value, ttlSeconds);
  return value;
}
