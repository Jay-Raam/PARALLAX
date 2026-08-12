import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { enqueue, QUEUES } from "../lib/queue.js";
import { getRedis } from "../lib/redis.js";
import { rateLimiter } from "../lib/rateLimit.js";

export const webhookRouter = Router();

const SUPPORTED_EVENTS = new Set([
  "push",
  "pull_request",
  "pull_request_review",
  "issues",
  "release",
  "workflow_run",
  "deployment",
  "deployment_status",
]);

function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!env.GITHUB_WEBHOOK_SECRET || !signature) return false;
  const expected = `sha256=${createHmac("sha256", env.GITHUB_WEBHOOK_SECRET).update(rawBody).digest("hex")}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function isDuplicate(deliveryId: string | undefined): Promise<boolean> {
  if (!deliveryId) return false;
  const redis = getRedis();
  if (redis) {
    const result = await redis.set(`parallax:webhook:${deliveryId}`, "1", "EX", 86_400, "NX");
    return result !== "OK";
  }
  // In-memory dedupe window
  const key = `parallax:webhook:${deliveryId}`;
  const existing = (globalThis as Record<string, unknown>)[key];
  (globalThis as Record<string, unknown>)[key] = true;
  setTimeout(() => delete (globalThis as Record<string, unknown>)[key], 86_400_000);
  return Boolean(existing);
}

webhookRouter.post("/github", rateLimiter({ limit: 120, windowMs: 60_000, keyPrefix: "webhook" }), async (req, res) => {
  const rawBody = (req as import("express").Request & { rawBody?: Buffer }).rawBody ?? Buffer.from("");
  const event = req.headers["x-github-event"] as string | undefined;
  const deliveryId = req.headers["x-github-delivery"] as string | undefined;
  const signature = req.headers["x-hub-signature-256"] as string | undefined;

  if (!SUPPORTED_EVENTS.has(event ?? "")) {
    res.status(202).json({ ok: true, ignored: true, reason: "unsupported-event" });
    return;
  }
  if (!verifySignature(rawBody, signature)) {
    logger.warn({ deliveryId }, "Webhook signature verification failed");
    res.status(401).json({ error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" } });
    return;
  }
  if (deliveryId && (await isDuplicate(deliveryId))) {
    res.status(202).json({ ok: true, deduplicated: true });
    return;
  }

  try {
    const payload = JSON.parse(rawBody.toString("utf8") || "{}") as Record<string, unknown>;
    const repositoryFullName = (payload.repository as { full_name?: string } | undefined)?.full_name;

    await enqueue(
      QUEUES.WEBHOOK_PROCESSING,
      event ?? "unknown",
      { event, deliveryId, payload, repositoryFullName },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
        jobId: `webhook-${deliveryId}`,
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 604_800 },
      },
    );
    res.status(202).json({ ok: true, queued: true });
  } catch (err) {
    logger.error({ err: (err as Error).message, event, deliveryId }, "Webhook queueing failed");
    res.status(500).json({ error: { code: "WEBHOOK_QUEUE_ERROR", message: "Could not process webhook" } });
  }
});
