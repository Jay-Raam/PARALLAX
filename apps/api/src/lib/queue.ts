import { Queue, Worker, type ConnectionOptions, type Job, type JobsOptions } from "bullmq";
import { getRedis } from "./redis.js";
import { isMemoryRedis } from "../config/env.js";
import { logger } from "../config/logger.js";

export interface JobHandler<T = unknown> {
  (job: { name: string; data: T; attempt: number }): Promise<void>;
}

interface MemoryQueueEntry {
  name: string;
  data: unknown;
  attempts: number;
  backoffMs: number;
}

const memoryQueues = new Map<string, MemoryQueueEntry[]>();
const memoryWorkers = new Map<string, JobHandler>();
const memoryRunning = new Set<string>();

export const QUEUES = {
  GITHUB_SYNC: "github-sync",
  REPOSITORY_ANALYSIS: "repository-analysis",
  ANALYTICS: "analytics",
  HEALTH_SCORE: "health-score",
  RECOMMENDATIONS: "recommendations",
  NOTIFICATIONS: "notifications",
  WEBHOOK_PROCESSING: "webhook-processing",
} as const;

function connection(): ConnectionOptions {
  return getRedis() as unknown as ConnectionOptions;
}

/** Enqueue a job. Idempotent when a stable `jobId` is provided (same id → no duplicate). */
export async function enqueue(
  queueName: string,
  name: string,
  data: unknown,
  opts: JobsOptions = {},
): Promise<void> {
  if (isMemoryRedis) {
    logger.info({ queueName, name, jobId: opts.jobId }, "Enqueuing memory queue job");
    const entry: MemoryQueueEntry = {
      name,
      data,
      attempts: opts.attempts ?? 1,
      backoffMs: 2_000,
    };
    if (opts.jobId) {
      const existing = memoryQueues.get(queueName) ?? [];
      if (existing.some((e) => (e.data as { __jobId?: string }).__jobId === opts.jobId)) {
        logger.info({ queueName, jobId: opts.jobId }, "Duplicate job detected, ignoring");
        return;
      }
      entry.data = { ...(data as object), __jobId: opts.jobId };
    }
    const list = memoryQueues.get(queueName) ?? [];
    list.push(entry);
    memoryQueues.set(queueName, list);
    void pump(queueName);
    return;
  }

  const queue = new Queue(queueName, { connection: connection() });
  try {
    await queue.add(name, data, opts);
  } finally {
    await queue.close();
  }
}

async function pump(queueName: string): Promise<void> {
  if (memoryRunning.has(queueName)) return;
  memoryRunning.add(queueName);
  try {
    for (;;) {
      const list = memoryQueues.get(queueName);
      const entry = list?.shift();
      if (!entry) break;
      const handler = memoryWorkers.get(queueName);
      logger.info({ queueName, jobName: entry.name, hasHandler: Boolean(handler) }, "Pumping memory queue job");
      if (!handler) {
        // no handler registered yet; put the job back and wait
        if (entry) (memoryQueues.get(queueName) ?? []).unshift(entry);
        break;
      }
      let attempt = 0;
      for (;;) {
        try {
          logger.info({ queueName, jobName: entry.name, attempt }, "Executing memory queue job handler");
          await handler({ name: entry.name, data: entry.data, attempt });
          logger.info({ queueName, jobName: entry.name }, "Memory queue job completed");
          break;
        } catch (err) {
          attempt += 1;
          if (attempt >= entry.attempts) {
            logger.error({ queueName, name: entry.name, err: (err as Error).message }, "Job failed permanently");
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, entry.backoffMs * 2 ** (attempt - 1)));
        }
      }
    }
  } finally {
    memoryRunning.delete(queueName);
  }
}

/** Register a processor for a queue. `concurrency` is honored by BullMQ; the memory queue processes serially. */
export function processQueue<T = unknown>(
  queueName: string,
  handler: JobHandler<T>,
  concurrency = 4,
): void {
  memoryWorkers.set(queueName, handler as JobHandler);
  if (isMemoryRedis) {
    void pump(queueName);
    return;
  }
  const worker = new Worker<T>(queueName, async (job: Job<T>) => {
    await handler({ name: job.name, data: job.data, attempt: job.attemptsMade });
  }, {
    connection: connection(),
    concurrency,
    limiter: { max: 20, duration: 1000 },
  });
  worker.on("failed", (job, err) => {
    logger.error({ queueName, jobId: job?.id, err: err.message }, "BullMQ job failed");
  });
  worker.on("error", (err) => {
    logger.warn({ queueName, err: err.message }, "BullMQ worker error");
  });
}

/** Drain all pending in-process jobs (used in tests). */
export async function drainMemoryQueues(): Promise<void> {
  for (const name of memoryQueues.keys()) {
    while ((memoryQueues.get(name)?.length ?? 0) > 0) {
      await pump(name);
      await new Promise((r) => setTimeout(r, 10));
    }
  }
}

export const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 86_400, count: 500 },
  removeOnFail: { age: 604_800, count: 1000 },
};
