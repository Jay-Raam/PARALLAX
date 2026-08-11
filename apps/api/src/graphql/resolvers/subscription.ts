import type { GraphQLContext } from "../context.js";
import { requireAuth, requireWorkspace } from "../context.js";
import { SyncJob } from "../../models/syncJob.js";
import { HealthScore } from "../../models/health.js";
import { WorkflowRun } from "../../models/workflow.js";
import { Deployment } from "../../models/deployment.js";
import { subscribeBus, type BusEvent } from "../../lib/pubsub.js";

/**
 * Subscribe to the local event bus (which mirrors Redis pub/sub when running
 * with a separate worker process) and expose it as an async iterator that
 * GraphQL Yoga can pull from.
 */
function busIterator(): AsyncIterator<BusEvent> {
  const queue: BusEvent[] = [];
  const waiters: ((value: IteratorResult<BusEvent>) => void)[] = [];
  let closed = false;
  const unsubscribe = subscribeBus((event) => {
    if (closed) return;
    const waiter = waiters.shift();
    if (waiter) waiter({ value: event, done: false });
    else queue.push(event);
  });
  return {
    next(): Promise<IteratorResult<BusEvent>> {
      if (queue.length) return Promise.resolve({ value: queue.shift()!, done: false });
      if (closed) return Promise.resolve({ value: undefined, done: true });
      return new Promise((resolve) => waiters.push(resolve));
    },
    return(): Promise<IteratorResult<BusEvent>> {
      closed = true;
      unsubscribe();
      while (waiters.length) waiters.shift()!({ value: undefined, done: true });
      return Promise.resolve({ value: undefined, done: true });
    },
  };
}

function filteredBusIterator(filter: (event: BusEvent) => boolean): AsyncIterator<BusEvent> {
  const source = busIterator();
  const queue: BusEvent[] = [];
  const waiters: ((value: IteratorResult<BusEvent>) => void)[] = [];
  let done = false;

  void (async () => {
    for (;;) {
      const result = await source.next();
      if (result.done) {
        done = true;
        for (const waiter of waiters.splice(0)) waiter({ value: undefined, done: true });
        return;
      }
      if (filter(result.value)) {
        const waiter = waiters.shift();
        if (waiter) waiter({ value: result.value, done: false });
        else queue.push(result.value);
      }
    }
  })();

  return {
    next(): Promise<IteratorResult<BusEvent>> {
      if (queue.length) return Promise.resolve({ value: queue.shift()!, done: false });
      if (done) return Promise.resolve({ value: undefined, done: true });
      return new Promise((resolve) => waiters.push(resolve));
    },
    return(): Promise<IteratorResult<BusEvent>> {
      done = true;
      return source.return?.() ?? Promise.resolve({ value: undefined, done: true });
    },
  };
}

async function loadSyncJob(jobId: string | undefined): Promise<unknown | null> {
  if (!jobId) return null;
  return SyncJob.findById(jobId).lean().exec();
}

export const subscriptionResolvers = {
  syncProgressUpdated: {
    subscribe: async function* (_parent: unknown, args: { repositoryId: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      requireWorkspace(ctx);
      const iterator = filteredBusIterator(
        (event) =>
          event.topic === "sync:progress" &&
          (event.payload as { repositoryId?: string })?.repositoryId === args.repositoryId,
      );
      yield* iterator as AsyncGenerator<BusEvent>;
    },
    resolve: async (payload: BusEvent) => loadSyncJob((payload.payload as { jobId?: string }).jobId),
  },

  notificationCreated: {
    subscribe: async function* (_parent: unknown, _args: unknown, ctx: GraphQLContext) {
      const workspaceId = requireWorkspace(ctx);
      requireAuth(ctx);
      const iterator = filteredBusIterator(
        (event) =>
          event.topic === "notification:created" &&
          (event.payload as { workspaceId?: string })?.workspaceId === workspaceId,
      );
      yield* iterator as AsyncGenerator<BusEvent>;
    },
    resolve: (payload: BusEvent) => (payload.payload as { notification?: unknown }).notification,
  },

  repositoryHealthUpdated: {
    subscribe: async function* (_parent: unknown, args: { repositoryId?: string }, ctx: GraphQLContext) {
      const workspaceId = requireWorkspace(ctx);
      requireAuth(ctx);
      const iterator = filteredBusIterator((event) => {
        if (event.topic !== "health:updated") return false;
        const payload = event.payload as { workspaceId?: string; repositoryId?: string };
        if (payload.workspaceId !== workspaceId) return false;
        return !args.repositoryId || payload.repositoryId === args.repositoryId;
      });
      yield* iterator as AsyncGenerator<BusEvent>;
    },
    resolve: async (payload: BusEvent) => {
      const repositoryId = (payload.payload as { repositoryId?: string }).repositoryId;
      if (!repositoryId) return null;
      const latest = await HealthScore.findOne({ repositoryId }).sort({ computedAt: -1 }).lean().exec();
      return latest
        ? {
            repositoryId: String(latest.repositoryId),
            overall: latest.overall,
            change: latest.change,
            computedAt: latest.computedAt,
          }
        : null;
    },
  },

  workflowRunUpdated: {
    subscribe: async function* (_parent: unknown, args: { repositoryId?: string }, ctx: GraphQLContext) {
      const workspaceId = requireWorkspace(ctx);
      requireAuth(ctx);
      const iterator = filteredBusIterator((event) => {
        if (event.topic !== "workflow:updated") return false;
        const payload = event.payload as { workspaceId?: string; repositoryId?: string };
        if (payload.workspaceId !== workspaceId) return false;
        return !args.repositoryId || payload.repositoryId === args.repositoryId;
      });
      yield* iterator as AsyncGenerator<BusEvent>;
    },
    resolve: async (payload: BusEvent) => {
      const runId = (payload.payload as { runId?: string }).runId;
      return runId ? WorkflowRun.findById(runId).lean().exec() : null;
    },
  },

  deploymentUpdated: {
    subscribe: async function* (_parent: unknown, args: { repositoryId?: string }, ctx: GraphQLContext) {
      const workspaceId = requireWorkspace(ctx);
      requireAuth(ctx);
      const iterator = filteredBusIterator((event) => {
        if (event.topic !== "deployment:updated") return false;
        const payload = event.payload as { workspaceId?: string; repositoryId?: string };
        if (payload.workspaceId !== workspaceId) return false;
        return !args.repositoryId || payload.repositoryId === args.repositoryId;
      });
      yield* iterator as AsyncGenerator<BusEvent>;
    },
    resolve: async (payload: BusEvent) => {
      const deploymentId = (payload.payload as { deploymentId?: string }).deploymentId;
      return deploymentId ? Deployment.findById(deploymentId).lean().exec() : null;
    },
  },
};
