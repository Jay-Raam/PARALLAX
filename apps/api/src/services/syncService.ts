import { Types } from "mongoose";
import type { GitHubPullRequestDTO } from "./github/types.js";
import { createMockGitHubClient, createGitHubClientForUser, type GitHubClient } from "./github/index.js";
import { Branch, Repository, type RepositoryDoc } from "../models/repository.js";
import { Commit } from "../models/commit.js";
import { PullRequest, PullRequestReview } from "../models/pullRequest.js";
import { Issue } from "../models/issue.js";
import { Dependency } from "../models/dependency.js";
import { SecurityAlert } from "../models/securityAlert.js";
import { Workflow, WorkflowRun } from "../models/workflow.js";
import { Deployment } from "../models/deployment.js";
import { Release } from "../models/release.js";
import { Contributor } from "../models/contributor.js";
import { SyncJob, type SyncJobDoc } from "../models/syncJob.js";
import { RepositoryMetric, type RepositoryMetricDoc } from "../models/metric.js";
import { prRiskService } from "./riskService.js";
import { cacheDelPrefix } from "../lib/cache.js";
import { getRedis } from "../lib/redis.js";
import { publishBus } from "../lib/pubsub.js";
import { GitHubApiError, SyncError } from "../lib/errors.js";
import { logger } from "../config/logger.js";

export interface SyncOptions {
  mode?: "FULL" | "INCREMENTAL";
  triggeredBy?: "WEBHOOK" | "MANUAL" | "SCHEDULE";
}

const memoryLocks = new Map<string, number>();
const LOCK_TTL_MS = 15 * 60 * 1000;

export async function acquireSyncLock(repositoryId: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const ok = await redis.set(`parallax:lock:sync:${repositoryId}`, String(Date.now()), "EX", 900, "NX");
    return ok === "OK";
  }
  const now = Date.now();
  const existing = memoryLocks.get(repositoryId);
  if (existing && existing > now - LOCK_TTL_MS) return false;
  memoryLocks.set(repositoryId, now);
  return true;
}

export async function releaseSyncLock(repositoryId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(`parallax:lock:sync:${repositoryId}`);
    return;
  }
  memoryLocks.delete(repositoryId);
}

export class SyncService {
  async createSyncJob(repositoryId: string, opts: SyncOptions = {}): Promise<SyncJobDoc> {
    const repo = await Repository.findById(repositoryId).lean().exec();
    if (!repo) throw new SyncError("Repository not found");
    const job = await SyncJob.create({
      workspaceId: repo.workspaceId,
      repositoryId,
      type: opts.mode ?? "FULL",
      status: "QUEUED",
      triggeredBy: opts.triggeredBy ?? "MANUAL",
      progress: { phase: "queued", current: 0, total: 0, percent: 0 },
      stats: {},
    });
    return job;
  }

  async updateProgress(
    job: SyncJobDoc,
    phase: string,
    progress: { current: number; total: number },
  ): Promise<void> {
    const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    await SyncJob.updateOne(
      { _id: job._id },
      { $set: { progress: { phase, current: progress.current, total: progress.total, percent }, status: "RUNNING" } },
    ).exec();
    await publishBus("sync:progress", {
      repositoryId: String(job.repositoryId),
      jobId: String(job._id),
      phase,
      current: progress.current,
      total: progress.total,
      percent,
      status: "RUNNING",
    });
  }

  async failJob(job: SyncJobDoc, error: string): Promise<void> {
    await SyncJob.updateOne(
      { _id: job._id },
      { $set: { status: "FAILED", error, completedAt: new Date() } },
    ).exec();
    await publishBus("sync:progress", {
      repositoryId: String(job.repositoryId),
      jobId: String(job._id),
      phase: "failed",
      current: 0,
      total: 0,
      percent: 0,
      status: "FAILED",
      error,
    });
  }

  async completeJob(job: SyncJobDoc, stats: Record<string, number>): Promise<void> {
    await SyncJob.updateOne(
      { _id: job._id },
      { $set: { status: "COMPLETED", stats, completedAt: new Date(), progress: { phase: "complete", current: stats.total ?? 0, total: stats.total ?? 0, percent: 100 } } },
    ).exec();
    await publishBus("sync:progress", {
      repositoryId: String(job.repositoryId),
      jobId: String(job._id),
      phase: "complete",
      current: stats.total ?? 0,
      total: stats.total ?? 0,
      percent: 100,
      status: "COMPLETED",
      stats,
    });
  }

  /**
   * Full synchronization pipeline. Idempotent: every write is an upsert keyed
   * by natural unique keys (githubId, sha, githubNumber, ...).
   */
  async runRepositorySync(job: SyncJobDoc, clientOverride?: GitHubClient): Promise<{ stats: Record<string, number>; repo: RepositoryDoc }> {
    const repositoryId = String(job.repositoryId);
    logger.info({ repositoryId, jobType: job.type }, "Starting runRepositorySync");
    const repo = await Repository.findById(repositoryId).lean().exec();
    if (!repo) throw new SyncError("Repository not found");

    let githubClient: GitHubClient;
    if (clientOverride) {
      githubClient = clientOverride;
    } else {
      const workspace = await this.findWorkspace(repo);
      githubClient = workspace ? await createGitHubClientForUser(String(workspace.ownerId)) : createMockGitHubClient();
    }

    const stats: Record<string, number> = {};

    logger.info({ repositoryId }, "Fetching repository metadata...");
    const meta = await githubClient.getRepository(repo.fullName).catch((err) => {
      if (err instanceof GitHubApiError && err.status === 404) {
        throw new SyncError(`Repository ${repo.fullName} not found on GitHub`, { repositoryId });
      }
      throw err;
    });
    if (!meta) throw new SyncError("Could not fetch repository metadata");

    /* Repository metadata */
    await this.updateProgress(job, "repository", { current: 1, total: 2 });
    await Repository.updateOne(
      { _id: repo._id },
      {
        $set: {
          syncStatus: "SYNCING",
          ...(meta.description !== undefined ? { description: meta.description } : {}),
          defaultBranch: meta.defaultBranch,
          language: meta.language,
          techStack: meta.techStack.length ? meta.techStack : repo.techStack,
          topics: meta.topics,
          starCount: meta.starCount,
          forkCount: meta.forkCount,
          openIssuesCount: meta.openIssuesCount,
          pushedAt: meta.pushedAt ? new Date(meta.pushedAt) : repo.pushedAt,
          isPrivate: meta.isPrivate,
          lastActivityAt: meta.pushedAt ? new Date(meta.pushedAt) : repo.lastActivityAt,
        },
      },
    ).exec();

    /* Branches */
    logger.info({ repositoryId }, "Fetching branches...");
    const branches = await githubClient.listBranches(meta);
    await Branch.bulkWrite(
      branches.map((b) => ({
        updateOne: {
          filter: { repositoryId, name: b.name },
          update: {
            $set: {
              headSha: b.headSha,
              isDefault: b.isDefault,
              lastCommitAt: b.lastCommitAt ? new Date(b.lastCommitAt) : undefined,
            },
          },
          upsert: true,
        },
      })) as never,
    );
    stats.branches = branches.length;

    /* Commits (incremental where possible) */
    const incremental = job.type === "INCREMENTAL" && repo.lastSyncedAt;
    logger.info({ repositoryId, incremental }, "Fetching commits...");
    const commits = await githubClient.listCommits(meta, incremental ? repo.lastSyncedAt?.toISOString() : undefined);
    logger.info({ repositoryId, commitCount: commits.length }, "Fetched commits successfully");
    if (commits.length) {
      logger.info({ repositoryId, commitCount: commits.length }, "Calling Commit.bulkWrite...");
      await Commit.bulkWrite(
        commits.map((c) => ({
          updateOne: {
            filter: { repositoryId, sha: c.sha },
            update: {
              $set: {
                authorLogin: c.authorLogin,
                authorName: c.authorName,
                authorEmail: c.authorEmail,
                message: c.message,
                messageTitle: c.message.split("\n")[0] ?? c.message,
                date: new Date(c.date),
                additions: c.additions,
                deletions: c.deletions,
                filesChanged: c.filesChanged,
                isMerge: c.isMerge,
                classification: c.classification,
              },
            },
            upsert: true,
          },
        })) as never,
      );
      logger.info({ repositoryId }, "Commit.bulkWrite finished");
      const latest = commits.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b));
      logger.info({ repositoryId, latestSha: latest.sha }, "Updating Repository with latestCommitSha...");
      await Repository.updateOne({ _id: repo._id }, { $set: { lastCommitSha: latest.sha } }).exec();
      logger.info({ repositoryId }, "Updated Repository with latestCommitSha successfully");
    }
    stats.commits = commits.length;
    await this.updateProgress(job, "commits", { current: commits.length, total: commits.length || 1 });

    /* Pull requests + reviews */
    logger.info({ repositoryId }, "Fetching pull requests...");
    const prs = await githubClient.listPullRequests(meta);
    for (let i = 0; i < prs.length; i += 50) {
      const batch = prs.slice(i, i + 50);
      const riskByNumber = new Map<number, { score: number; level: string; factors: string[]; explanation: string }>();
      for (const pr of batch) {
        riskByNumber.set(pr.githubNumber, this.computePrRisk(pr));
      }
      await PullRequest.bulkWrite(
        batch.map((pr) => {
          const risk = riskByNumber.get(pr.githubNumber)!;
          const lifecycle = this.buildLifecycle(pr);
          return {
            updateOne: {
              filter: { repositoryId, githubNumber: pr.githubNumber },
              update: {
                $set: {
                  title: pr.title,
                  body: pr.body,
                  state: pr.state,
                  authorLogin: pr.authorLogin,
                  createdAt: new Date(pr.createdAt),
                  updatedAt: pr.updatedAt ? new Date(pr.updatedAt) : undefined,
                  closedAt: pr.closedAt ? new Date(pr.closedAt) : undefined,
                  mergedAt: pr.mergedAt ? new Date(pr.mergedAt) : undefined,
                  mergedBy: pr.mergedBy,
                  baseRef: pr.baseRef,
                  headRef: pr.headRef,
                  additions: pr.additions,
                  deletions: pr.deletions,
                  changedFiles: pr.changedFiles,
                  commits: pr.commits,
                  isDraft: pr.isDraft,
                  labels: pr.labels,
                  reviewDecision: pr.reviewDecision,
                  riskScore: risk.score,
                  riskLevel: risk.level,
                  riskFactors: risk.factors,
                  riskExplanation: risk.explanation,
                  reviewTimeMs: this.gapMs(pr, "created", "review"),
                  approvalTimeMs: this.gapMs(pr, "review", "approved"),
                  mergeTimeMs: this.gapMs(pr, "approved", "merged"),
                  deployTimeMs: this.gapMs(pr, "merged", "deployed"),
                  testFilesChanged: this.classify(pr).testFilesChanged,
                  dependenciesChanged: this.classify(pr).dependenciesChanged,
                  authFilesChanged: this.classify(pr).authFilesChanged,
                  migrationFilesChanged: this.classify(pr).migrationFilesChanged,
                  files: pr.files,
                  lifecycle,
                },
              },
              upsert: true,
            },
          };
        }) as never,
      );
      for (const pr of batch) {
        const prDoc = await PullRequest.findOne({ repositoryId, githubNumber: pr.githubNumber }).select("_id").lean().exec();
        await PullRequestReview.deleteMany({ pullRequestId: prDoc?._id });
        if (prDoc && pr.reviews.length) {
          await PullRequestReview.bulkWrite(
            pr.reviews.map((r) => ({
              updateOne: {
                filter: { pullRequestId: prDoc._id, reviewerLogin: r.reviewerLogin, submittedAt: r.submittedAt ? new Date(r.submittedAt) : undefined },
                update: { $set: { reviewerLogin: r.reviewerLogin, state: r.state, submittedAt: r.submittedAt ? new Date(r.submittedAt) : undefined, body: r.body } },
                upsert: true,
              },
            })) as never,
          );
        }
      }
      await this.updateProgress(job, "pull-requests", { current: Math.min(i + 50, prs.length), total: prs.length || 1 });
    }
    stats.pullRequests = prs.length;

    /* Issues */
    const issues = await githubClient.listIssues(meta);
    await Issue.bulkWrite(
      issues.map((i) => ({
        updateOne: {
          filter: { repositoryId, githubNumber: i.githubNumber },
          update: {
            $set: {
              title: i.title,
              body: i.body,
              state: i.state,
              authorLogin: i.authorLogin,
              createdAt: new Date(i.createdAt),
              updatedAt: i.updatedAt ? new Date(i.updatedAt) : undefined,
              closedAt: i.closedAt ? new Date(i.closedAt) : undefined,
              labels: i.labels,
              assignees: i.assignees,
              commentsCount: i.commentsCount,
            },
          },
          upsert: true,
        },
      })) as never,
    );
    stats.issues = issues.length;

    /* Releases */
    const releases = await githubClient.listReleases(meta);
    await Release.bulkWrite(
      releases.map((r) => ({
        updateOne: {
          filter: { repositoryId, tagName: r.tagName },
          update: {
            $set: {
              name: r.name,
              publishedAt: new Date(r.publishedAt),
              authorLogin: r.authorLogin,
              isPrerelease: r.isPrerelease,
              body: r.body,
              commitSha: r.commitSha,
              commitCount: r.commitCount,
              features: r.features,
              bugFixes: r.bugFixes,
              breakingChanges: r.breakingChanges,
              dependencyChanges: r.dependencyChanges,
            },
          },
          upsert: true,
        },
      })) as never,
    );
    stats.releases = releases.length;

    /* Workflows + runs */
    const workflows = await githubClient.listWorkflows(meta);
    await Workflow.bulkWrite(
      workflows.map((w) => ({
        updateOne: {
          filter: { repositoryId, name: w.name },
          update: { $set: { path: w.path, state: w.state } },
          upsert: true,
        },
      })) as never,
    );
    const workflowDocs = await Workflow.find({ repositoryId }).select("_id name").lean().exec();
    const workflowIdByName = new Map(workflowDocs.map((w) => [w.name, w._id.toString()]));
    const runs = await githubClient.listWorkflowRuns(meta);
    await WorkflowRun.bulkWrite(
      runs.map((r) => ({
        updateOne: {
          filter: { repositoryId, runNumber: r.runNumber },
          update: {
            $set: {
              workflowId: workflowIdByName.get(r.workflowName) ?? workflowDocs[0]?._id,
              workflowName: r.workflowName,
              event: r.event,
              status: r.status,
              headSha: r.headSha,
              branch: r.branch,
              createdAt: new Date(r.createdAt),
              durationMs: r.durationMs,
              steps: r.steps,
            },
          },
          upsert: true,
        },
      })) as never,
    );
    stats.workflowRuns = runs.length;

    /* Deployments */
    const deployments = await githubClient.listDeployments(meta);
    await Deployment.bulkWrite(
      deployments.map((d) => ({
        updateOne: {
          filter: { repositoryId, createdAt: new Date(d.createdAt), environment: d.environment, ref: d.ref },
          update: {
            $set: {
              sha: d.sha,
              creatorLogin: d.creatorLogin,
              status: d.status,
              description: d.description,
              version: d.version,
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      })) as never,
    );
    stats.deployments = deployments.length;

    /* Dependencies */
    const deps = await githubClient.listDependencies(meta);
    await Dependency.bulkWrite(
      deps.map((d) => ({
        updateOne: {
          filter: { repositoryId, name: d.name },
          update: {
            $set: {
              ecosystem: d.ecosystem,
              currentVersion: d.currentVersion,
              latestVersion: d.latestVersion,
              updateType: d.updateType,
              risk: d.risk,
              vulnerabilities: d.vulnerabilities,
              isDirect: d.isDirect,
              outdated: d.outdated,
              packageManager: d.packageManager,
            },
          },
          upsert: true,
        },
      })) as never,
    );
    stats.dependencies = deps.length;

    /* Security alerts */
    const alerts = await githubClient.listSecurityAlerts(meta);
    await SecurityAlert.deleteMany({ repositoryId });
    if (alerts.length) {
      await SecurityAlert.bulkWrite(
        alerts.map((a) => ({
          updateOne: {
            filter: { repositoryId, githubId: a.githubId },
            update: {
              $set: {
                githubId: a.githubId,
                type: a.type,
                severity: a.severity,
                title: a.title,
                description: a.description,
                state: a.state,
                url: a.url,
                packageName: a.packageName,
              },
            },
            upsert: true,
          },
        })) as never,
      );
    }
    stats.securityAlerts = alerts.length;

    /* Contributors */
    const contributors = await githubClient.listContributors(meta);
    await Contributor.bulkWrite(
      contributors.map((c) => ({
        updateOne: {
          filter: { repositoryId, login: c.login },
          update: {
            $set: {
              name: c.name,
              avatarUrl: c.avatarUrl,
              role: c.role,
              commits: c.commits,
              additions: c.additions,
              deletions: c.deletions,
              pullRequestsCreated: c.pullRequestsCreated,
              reviewsGiven: c.reviewsGiven,
              issuesOpened: c.issuesOpened,
              issuesClosed: c.issuesClosed,
              firstContributionAt: new Date(c.firstContributionAt),
              lastContributionAt: new Date(c.lastContributionAt),
            },
          },
          upsert: true,
        },
      })) as never,
    );
    stats.contributors = contributors.length;
    stats.total = stats.commits + stats.pullRequests + stats.issues;

    await Repository.updateOne(
      { _id: repo._id },
      { $set: { syncStatus: "SYNCED", lastSyncedAt: new Date(), lastActivityAt: meta.pushedAt ? new Date(meta.pushedAt) : new Date() } },
    ).exec();

    const updated = (await Repository.findById(repo._id).lean().exec())!;
    await cacheDelPrefix(`repository:${repo._id}`);
    return { stats, repo: updated };
  }

  /* ── helpers ──────────────────────────────────────────── */

  private computePrRisk(pr: GitHubPullRequestDTO) {
    return prRiskService.compute({
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      files: pr.files,
      ...this.classify(pr),
    });
  }

  private classify(pr: GitHubPullRequestDTO) {
    return prRiskService.classifyFiles(pr.files);
  }

  private buildLifecycle(pr: GitHubPullRequestDTO) {
    const stages: { stage: string; at?: Date }[] = [{ stage: "created", at: new Date(pr.createdAt) }];
    const firstReview = pr.reviews.find((r) => r.submittedAt);
    if (firstReview?.submittedAt) stages.push({ stage: "review", at: new Date(firstReview.submittedAt) });
    const approval = pr.reviews.find((r) => r.state === "APPROVED" && r.submittedAt);
    if (approval?.submittedAt) stages.push({ stage: "approved", at: new Date(approval.submittedAt) });
    if (pr.mergedAt) stages.push({ stage: "merged", at: new Date(pr.mergedAt) });
    if (pr.deployAt) stages.push({ stage: "deployed", at: new Date(pr.deployAt) });
    return stages;
  }

  private gapMs(pr: GitHubPullRequestDTO, from: string, to: string): number | undefined {
    const fromAt = this.stageAt(pr, from);
    const toAt = this.stageAt(pr, to);
    if (!fromAt || !toAt) return undefined;
    const gap = toAt - fromAt;
    return gap > 0 ? gap : undefined;
  }

  private stageAt(pr: GitHubPullRequestDTO, stage: string): number | undefined {
    switch (stage) {
      case "created":
        return new Date(pr.createdAt).getTime();
      case "review": {
        const review = pr.reviews.find((r) => r.submittedAt);
        return review?.submittedAt ? new Date(review.submittedAt).getTime() : undefined;
      }
      case "approved": {
        const approval = pr.reviews.find((r) => r.state === "APPROVED" && r.submittedAt);
        return approval?.submittedAt ? new Date(approval.submittedAt).getTime() : undefined;
      }
      case "merged":
        return pr.mergedAt ? new Date(pr.mergedAt).getTime() : undefined;
      case "deployed":
        return pr.deployAt ? new Date(pr.deployAt).getTime() : undefined;
      default:
        return undefined;
    }
  }

  private async findWorkspace(repo: RepositoryDoc) {
    const { Workspace } = await import("../models/workspace.js");
    return Workspace.findById(repo.workspaceId).lean().exec();
  }

  /* ── daily metrics precompute ─────────────────────────── */

  async buildDailyMetrics(repositoryId: string, workspaceId: string): Promise<void> {
    const days = 120;
    const since = new Date(Date.now() - days * 86_400_000);

    const [commitBuckets, prBuckets, issueBuckets, deployBuckets, releaseBuckets, runBuckets] =
      await Promise.all([
        Commit.aggregate<{ _id: string; commits: number; additions: number; deletions: number; contributors: string[] }>([
          { $match: { repositoryId: new Types.ObjectId(repositoryId), date: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
              commits: { $sum: 1 },
              additions: { $sum: "$additions" },
              deletions: { $sum: "$deletions" },
              contributors: { $addToSet: "$authorLogin" },
            },
          },
        ]),
        PullRequest.aggregate<{ _id: string; opened: number; merged: number }>([
          { $match: { repositoryId: new Types.ObjectId(repositoryId), createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              opened: { $sum: 1 },
              merged: { $sum: { $cond: [{ $eq: ["$state", "MERGED"] }, 1, 0] } },
            },
          },
        ]),
        Issue.aggregate<{ _id: string; opened: number; closed: number }>([
          { $match: { repositoryId: new Types.ObjectId(repositoryId), createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              opened: { $sum: 1 },
              closed: { $sum: { $cond: [{ $eq: ["$state", "CLOSED"] }, 1, 0] } },
            },
          },
        ]),
        Deployment.aggregate<{ _id: string; deployments: number; failed: number }>([
          { $match: { repositoryId: new Types.ObjectId(repositoryId), createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              deployments: { $sum: 1 },
              failed: { $sum: { $cond: [{ $eq: ["$status", "FAILURE"] }, 1, 0] } },
            },
          },
        ]),
        Release.aggregate<{ _id: string; releases: number }>([
          { $match: { repositoryId: new Types.ObjectId(repositoryId), publishedAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$publishedAt" } },
              releases: { $sum: 1 },
            },
          },
        ]),
        WorkflowRun.aggregate<{ _id: string; runs: number; failures: number; avgMs: number }>([
          { $match: { repositoryId: new Types.ObjectId(repositoryId), createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              runs: { $sum: 1 },
              failures: { $sum: { $cond: [{ $in: ["$status", ["FAILURE", "CANCELLED", "ACTION_REQUIRED"]] }, 1, 0] } },
              avgMs: { $avg: "$durationMs" },
            },
          },
        ]),
      ]);

    const byDay = new Map<string, Partial<RepositoryMetricDoc>>();
    const add = (date: string, patch: Partial<RepositoryMetricDoc>) => {
      const entry = byDay.get(date) ?? { date: new Date(`${date}T00:00:00.000Z`) };
      Object.assign(entry, patch);
      byDay.set(date, entry);
    };

    for (const b of commitBuckets) {
      add(b._id, { commits: b.commits, additions: b.additions, deletions: b.deletions, contributors: b.contributors.length });
    }
    for (const b of prBuckets) add(b._id, { pullRequestsOpened: b.opened, pullRequestsMerged: b.merged });
    for (const b of issueBuckets) add(b._id, { issuesOpened: b.opened, issuesClosed: b.closed });
    for (const b of deployBuckets) add(b._id, { deployments: b.deployments, deploymentsFailed: b.failed });
    for (const b of releaseBuckets) add(b._id, { releases: b.releases });
    for (const b of runBuckets) {
      add(b._id, { buildRuns: b.runs, buildFailures: b.failures, avgBuildTimeMs: b.avgMs ?? 0 });
    }

    const ops = [...byDay.entries()].map(([date, patch]) => ({
      updateOne: {
        filter: { repositoryId, workspaceId, date: new Date(`${date}T00:00:00.000Z`) },
        update: { $set: { ...patch, workspaceId, repositoryId, date: new Date(`${date}T00:00:00.000Z`) } },
        upsert: true,
      },
    }));
    if (ops.length) await RepositoryMetric.bulkWrite(ops as never);
  }
}

export const syncService = new SyncService();
