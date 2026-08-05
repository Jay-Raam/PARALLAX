import { Redis } from "ioredis";
import { env, isMemoryRedis } from "../config/env.js";
import { logger } from "../config/logger.js";

export type RedisClient = InstanceType<typeof Redis>;

let client: RedisClient | null = null;

export function getRedis(): Redis | null {
  if (isMemoryRedis) return null;
  if (client) return client;
  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times) {
      return Math.min(times * 500, 5000);
    },
  });
  client.on("error", (err) => {
    logger.warn({ err: err.message }, "Redis error");
  });
  client.on("connect", () => logger.info("Redis connected"));
  client.connect().catch((err) => logger.warn({ err: err.message }, "Redis connect failed"));
  return client;
}

export async function pingRedis(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true; // memory mode
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    client.disconnect();
    client = null;
  }
}
