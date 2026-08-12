import { Types } from "mongoose";
import { enqueue, processQueue, QUEUES } from "../lib/queue.js";
import { publishBus } from "../lib/pubsub.js";
import { cacheDelPrefix } from "../lib/cache.js";
import { logger } from "../config/logger.js";
import { syncService, acquireSyncLock, releaseSyncLock } from "../services/syncService.js";
import { healthService } from "../services/healthService.js";
import { recommendationService } from "../services/recommendationService.js";
import { notificationService } from "../services/notificationService.js";
import { SyncJob } from "../models/syncJob.js";
import { Repository } from "../models/repository.js";
import { PullRequest, PullRequestReview } from "../models/pullRequest.js";
import { Issue } from "../models/issue.js";
import { Release } from "../models/release.js";
import { WorkflowRun } from "../models/workflow.js";
import { Deployment } from "../models/deployment.js";
import { prRiskService } from "../services/riskService.js";

const oid = (id: string) => new Types.ObjectId(id);

export function registerProcessors(): void {
  processQueue<{ jobId: string; repositoryId: string }>(QUEUES.GITHUB_SYNC, async (job) => {
    const { jobId, repositoryId } = job.data;
    const syncJob = await SyncJob.findById(jobId).lean().exec();
    if (!syncJob) {
      logger.warn({ jobId }, "Sync job not found");
      return;
    }

    const locked = await acquireSyncLock(repositoryId);
    if (!locked) {
      logger.info({ repositoryId }, "Another sync is already running; skipping");
      return;
    }

    try {
      await SyncJob.updateOne({ _id: syncJob._id }, { $set: { status: "RUNNING", startedAt: new Date() } }).exec();
      const { stats, repo } = await syncService.runRepositorySync(syncJob);
      await syncService.completeJob(syncJob, stats);

      // Chain downstream analysis
      await enqueue(QUEUES.REPOSITORY_ANALYSIS, "build-metrics", { repositoryId, workspaceId: String(repo.workspaceId) });
      await enqueue(QUEUES.HEALTH_SCORE, "compute-health", { repositoryId, workspaceId: String(repo.workspaceId) });
      await enqueue(QUEUES.RECOMMENDATIONS, "generate-recommendations", { workspaceId: String(repo.workspaceId) });
      await enqueue(QUEUES.NOTIFICATIONS, "sync-notifications", { repositoryId, workspaceId: String(repo.workspaceId) });

      logger.info({ repositoryId, stats }, "Repository sync completed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await syncService.failJob(syncJob, message);
      await Repository.updateOne({ _id: oid(repositoryId) }, { $set: { syncStatus: "ERROR" } }).exec().catch(() => undefined);
      logger.error({ repositoryId, err }, "Repository sync failed");
      throw err;
    } finally {
      await releaseSyncLock(repositoryId);
    }
  }, 2);

  processQueue<{ repositoryId: string; workspaceId: string }>(QUEUES.REPOSITORY_ANALYSIS, async (job) => {
    const { repositoryId, workspaceId } = job.data;
    await syncService.buildDailyMetrics(repositoryId, workspaceId);
    await cacheDelPrefix(`repository:${repositoryId}`);
    await cacheDelPrefix(`analytics:${workspaceId}`);
    logger.info({ repositoryId }, "Daily metrics built");
  }, 2);

  processQueue<{ workspaceId: string }>(QUEUES.ANALYTICS, async (job) => {
    await cacheDelPrefix(`analytics:${job.data.workspaceId}`);
    await cacheDelPrefix(`overview:${job.data.workspaceId}`);
  }, 1);

  processQueue<{ repositoryId: string; workspaceId: string }>(QUEUES.HEALTH_SCORE, async (job) => {
    const { repositoryId, workspaceId } = job.data;
    const result = await healthService.computeForRepository({ repositoryId, workspaceId });
    await cacheDelPrefix(`health:${repositoryId}`);
    await publishBus("health:updated", { workspaceId, repositoryId, overall: result.overall, change: result.change });

    if (result.change <= -10) {
      await notificationService.create({
        workspaceId,
        type: "HEALTH_DROP",
        severity: "HIGH",
        title: `Health score dropped to ${result.overall}`,
        body: `Engineering health for the repository decreased by ${Math.abs(result.change)} points.`,
        data: { repositoryId, overall: result.overall, change: result.change },
        url: "/overview",
        dedupeKey: `health-drop:${repositoryId}:${new Date().toISOString().slice(0, 10)}`,
      });
    }
    logger.info({ repositoryId, overall: result.overall, change: result.change }, "Health computed");
  }, 2);

  processQueue<{ workspaceId: string }>(QUEUES.RECOMMENDATIONS, async (job) => {
    const saved = await recommendationService.generateForWorkspace(job.data.workspaceId);
    await recommendationService.notifyForNewHighPriority(job.data.workspaceId, saved);
    logger.info({ workspaceId: job.data.workspaceId, generated: saved.length }, "Recommendations generated");
  }, 1);

  processQueue<{ repositoryId: string; workspaceId: string }>(QUEUES.NOTIFICATIONS, async (job) => {
    const { repositoryId, workspaceId } = job.data;
    const repo = await Repository.findById(repositoryId).select("name").lean().exec();

    // High-risk PRs
    const risky = await PullRequest.find({ repositoryId, state: "OPEN", riskScore: { $gte: 60 } })
      .select("githubNumber title riskScore")
      .sort({ riskScore: -1 })
      .limit(5)
      .lean()
      .exec();
    for (const pr of risky) {
      await notificationService.create({
        workspaceId,
        type: "PR_RISK",
        severity: (pr.riskScore ?? 0) >= 75 ? "CRITICAL" : "HIGH",
        title: `High-risk PR #${pr.githubNumber}`,
        body: `PR #${pr.githubNumber} "${pr.title}" has a risk score of ${pr.riskScore}.`,
        data: { repositoryId, pullRequestId: String(pr._id), githubNumber: pr.githubNumber, riskScore: pr.riskScore },
        url: "/pull-requests",
        dedupeKey: `pr-risk:${repositoryId}:${String(pr._id)}`,
      });
    }

    // Sync complete
    await notificationService.create({
      workspaceId,
      type: "SYNC_COMPLETE",
      severity: "INFO",
      title: `Repository sync complete`,
      body: `${repo?.name ?? "Repository"} is up to date.`,
      data: { repositoryId },
      url: "/repositories",
      dedupeKey: `sync-complete:${repositoryId}:${new Date().toISOString().slice(0, 10)}`,
    });

    logger.info({ repositoryId, risky: risky.length }, "Sync notifications dispatched");
  }, 1);

  processQueue<{ event: string; deliveryId?: string; payload: Record<string, unknown>; repositoryFullName?: string }>(
    QUEUES.WEBHOOK_PROCESSING,
    async (job) => {
      const { event, payload, repositoryFullName } = job.data;
      await handleWebhookEvent(event, repositoryFullName, payload, job.attempt);
    },
    4,
  );
}

/* ── webhook handlers (best-effort, idempotent) ─────────── */

async function handleWebhookEvent(
  event: string,
  repositoryFullName: string | undefined,
  payload: Record<string, unknown>,
  attempt: number,
): Promise<void> {
  if (!repositoryFullName) return;
  const repo = await Repository.findOne({ fullName: repositoryFullName, enabled: true }).select("_id workspaceId").lean().exec();
  if (!repo) {
    logger.info({ repositoryFullName }, "Webhook received for unknown repository; ignoring");
    return;
  }
  const repositoryId = String(repo._id);
  const workspaceId = String(repo.workspaceId);

  switch (event) {
    case "push":
      await enqueue(QUEUES.GITHUB_SYNC, "sync-repository", { repositoryId, jobId: String((await syncService.createSyncJob(repositoryId, { mode: "INCREMENTAL", triggeredBy: "WEBHOOK" }))._id) });
      break;
    case "pull_request":
      await upsertPrFromWebhook(repo, payload);
      break;
    case "pull_request_review":
      await upsertReviewFromWebhook(repo, payload);
      break;
    case "issues":
      await upsertIssueFromWebhook(repo, payload);
      break;
    case "release":
      await upsertReleaseFromWebhook(repo, payload);
      break;
    case "workflow_run":
      await upsertRunFromWebhook(repo, payload);
      break;
    case "deployment":
    case "deployment_status":
      await upsertDeploymentFromWebhook(repo, payload);
      break;
    default:
      break;
  }
  void attempt;
  void workspaceId;
}

async function upsertPrFromWebhook(repo: { _id: unknown; workspaceId: unknown }, payload: Record<string, unknown>) {
  const action = payload.action as string | undefined;
  if (action === "deleted") return;
  const pr = payload.pull_request as
    | {
        number: number;
        title: string;
        state: string;
        merged_at: string | null;
        created_at: string;
        updated_at: string | null;
        closed_at: string | null;
        user: { login: string };
        base: { ref: string };
        head: { ref: string };
        additions?: number;
        deletions?: number;
        changed_files?: number;
        draft?: boolean;
      }
    | undefined;
  if (!pr) return;
  const files: string[] = [];
  const classification = prRiskService.classifyFiles(files);
  await PullRequest.updateOne(
    { repositoryId: String(repo._id), githubNumber: pr.number },
    {
      $set: {
        title: pr.title,
        state: pr.state === "closed" ? (pr.merged_at ? "MERGED" : "CLOSED") : "OPEN",
        authorLogin: pr.user.login,
        createdAt: new Date(pr.created_at),
        updatedAt: pr.updated_at ? new Date(pr.updated_at) : undefined,
        closedAt: pr.closed_at ? new Date(pr.closed_at) : undefined,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
        baseRef: pr.base.ref,
        headRef: pr.head.ref,
        additions: pr.additions ?? 0,
        deletions: pr.deletions ?? 0,
        changedFiles: pr.changed_files ?? 0,
        isDraft: pr.draft ?? false,
        ...classification,
      },
    },
    { upsert: true },
  ).exec();
}

async function upsertReviewFromWebhook(repo: { _id: unknown }, payload: Record<string, unknown>) {
  const review = payload.review as { user?: { login: string }; state?: string; submitted_at?: string; body?: string } | undefined;
  const pr = payload.pull_request as { number?: number } | undefined;
  if (!review || !pr?.number) return;
  const prDoc = await PullRequest.findOne({ repositoryId: String(repo._id), githubNumber: pr.number }).select("_id").lean().exec();
  if (!prDoc) return;
  await PullRequestReview.updateOne(
    { pullRequestId: prDoc._id, reviewerLogin: review.user?.login ?? "", submittedAt: review.submitted_at ? new Date(review.submitted_at) : undefined },
    { $set: { state: review.state ?? "COMMENTED", submittedAt: review.submitted_at ? new Date(review.submitted_at) : undefined, body: review.body } },
    { upsert: true },
  ).exec();
}

async function upsertIssueFromWebhook(repo: { _id: unknown }, payload: Record<string, unknown>) {
  const issue = payload.issue as
    | { number?: number; title?: string; state?: string; created_at?: string; updated_at?: string; closed_at?: string | null; user?: { login: string }; labels?: { name: string }[] }
    | undefined;
  if (!issue?.number) return;
  await Issue.updateOne(
    { repositoryId: String(repo._id), githubNumber: issue.number },
    {
      $set: {
        title: issue.title ?? "",
        state: issue.state === "closed" ? "CLOSED" : "OPEN",
        authorLogin: issue.user?.login ?? "unknown",
        createdAt: issue.created_at ? new Date(issue.created_at) : new Date(),
        updatedAt: issue.updated_at ? new Date(issue.updated_at) : undefined,
        closedAt: issue.closed_at ? new Date(issue.closed_at) : undefined,
        labels: issue.labels?.map((l) => l.name) ?? [],
      },
    },
    { upsert: true },
  ).exec();
}

async function upsertReleaseFromWebhook(repo: { _id: unknown }, payload: Record<string, unknown>) {
  const release = payload.release as
    | { tag_name?: string; name?: string | null; published_at?: string; prerelease?: boolean; body?: string | null; author?: { login: string } }
    | undefined;
  if (!release?.tag_name || payload.action === "deleted") return;
  await Release.updateOne(
    { repositoryId: String(repo._id), tagName: release.tag_name },
    {
      $set: {
        name: release.name ?? undefined,
        publishedAt: release.published_at ? new Date(release.published_at) : new Date(),
        authorLogin: release.author?.login ?? "unknown",
        isPrerelease: release.prerelease ?? false,
        body: release.body ?? undefined,
        features: [],
        bugFixes: [],
        breakingChanges: [],
        dependencyChanges: [],
      },
    },
    { upsert: true },
  ).exec();
}

async function upsertRunFromWebhook(repo: { _id: unknown; workspaceId: unknown }, payload: Record<string, unknown>) {
  const run = payload.workflow_run as
    | { id?: number; run_number?: number; name?: string | null; event?: string; status?: string; conclusion?: string | null; head_sha?: string; head_branch?: string; created_at?: string; updated_at?: string }
    | undefined;
  if (!run?.id) return;
  const started = run.created_at ? new Date(run.created_at).getTime() : Date.now();
  const finished = run.updated_at ? new Date(run.updated_at).getTime() : started;
  const doc = await WorkflowRun.findOneAndUpdate(
    { repositoryId: String(repo._id), runNumber: run.run_number ?? run.id },
    {
      $set: {
        workflowName: run.name ?? "CI",
        event: run.event ?? "push",
        status: (run.conclusion ?? run.status ?? "QUEUED").toUpperCase(),
        headSha: run.head_sha ?? "",
        branch: run.head_branch ?? "main",
        createdAt: run.created_at ? new Date(run.created_at) : new Date(),
        durationMs: finished > started ? finished - started : undefined,
        steps: [],
      },
    },
    { upsert: true, new: true },
  ).exec();
  if (doc) {
    await publishBus("workflow:updated", { workspaceId: String(repo.workspaceId), repositoryId: String(repo._id), runId: String(doc._id) });
  }
}

async function upsertDeploymentFromWebhook(repo: { _id: unknown; workspaceId: unknown }, payload: Record<string, unknown>) {
  const deployment = payload.deployment as
    | { id?: number; environment?: string; ref?: string; sha?: string; created_at?: string; creator?: { login: string }; description?: string | null }
    | undefined;
  if (!deployment?.id) return;
  const status = (payload.deployment_status as { state?: string } | undefined)?.state ?? "pending";
  const doc = await Deployment.findOneAndUpdate(
    { repositoryId: String(repo._id), githubId: deployment.id },
    {
      $set: {
        environment: deployment.environment ?? "Production",
        ref: deployment.ref ?? "main",
        sha: deployment.sha ?? "",
        creatorLogin: deployment.creator?.login ?? "unknown",
        status: status.toUpperCase(),
        description: deployment.description ?? undefined,
        createdAt: deployment.created_at ? new Date(deployment.created_at) : new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  ).exec();
  if (doc) {
    await publishBus("deployment:updated", { workspaceId: String(repo.workspaceId), repositoryId: String(repo._id), deploymentId: String(doc._id) });
  }
}
