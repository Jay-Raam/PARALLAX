import type { NextFunction, Request, Response } from "express";
import { getRedis } from "./redis.js";
import { env } from "../config/env.js";

const memoryCounts = new Map<string, { count: number; resetAt: number }>();

export async function consumeRateLimit(
  key: string,
  limit: number = env.RATE_LIMIT_MAX,
  windowMs: number = env.RATE_LIMIT_WINDOW_MS,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedis();
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);

  if (redis) {
    const redisKey = `parallax:ratelimit:${key}:${bucket}`;
    const multi = redis.multi();
    multi.incr(redisKey);
    multi.expire(redisKey, Math.ceil(windowMs / 1000));
    const results = (await multi.exec()) as [[Error | null, number], [Error | null, number]];
    const count = results[0]?.[1] ?? 1;
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: (bucket + 1) * windowMs,
    };
  }

  const entry = memoryCounts.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryCounts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

export function rateLimiter(opts?: { limit?: number; windowMs?: number; keyPrefix?: string }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${opts?.keyPrefix ?? "global"}:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
    const result = await consumeRateLimit(key, opts?.limit, opts?.windowMs);
    res.setHeader("X-RateLimit-Limit", String(opts?.limit ?? env.RATE_LIMIT_MAX));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));
    if (!result.allowed) {
      res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests" } });
      return;
    }
    next();
  };
}
