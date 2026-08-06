import { EventEmitter } from "node:events";
import { getRedis } from "./redis.js";
import { isMemoryRedis } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * Cross-process event bus used to forward worker events (sync progress,
 * health updates, notifications...) to the API process, which re-emits them
 * to GraphQL subscriptions. Falls back to an in-process EventEmitter when
 * Redis is not available (embedded worker mode).
 */
export const BUS_CHANNEL = "parallax:events";

export interface BusEvent {
  topic: string;
  payload: unknown;
}

type Handler = (event: BusEvent) => void;

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

let redisSubscriber: import("./redis.js").RedisClient | null = null;
let subscribed = false;

function ensureSubscriber() {
  const redis = getRedis();
  if (!redis || subscribed) return;
  redisSubscriber = redis.duplicate();
  redisSubscriber.subscribe(BUS_CHANNEL);
  redisSubscriber.on("message", (channel, message) => {
    if (channel !== BUS_CHANNEL) return;
    try {
      const event = JSON.parse(message) as BusEvent;
      emitter.emit("bus", event);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Failed to parse bus event");
    }
  });
  subscribed = true;
}

export function subscribeBus(handler: Handler): () => void {
  ensureSubscriber();
  emitter.on("bus", handler);
  return () => emitter.off("bus", handler);
}

export async function publishBus(topic: string, payload: unknown): Promise<void> {
  const event: BusEvent = { topic, payload };
  const redis = getRedis();
  if (redis && !isMemoryRedis) {
    try {
      await redis.publish(BUS_CHANNEL, JSON.stringify(event));
      return;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Redis publish failed, falling back to local emit");
    }
  }
  emitter.emit("bus", event);
}
