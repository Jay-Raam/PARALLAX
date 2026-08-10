import { Types } from "mongoose";
import { clamp } from "@parallax/shared";
import type { ActivityFilter, Range } from "@parallax/shared";
import { Commit } from "../models/commit.js";
import { Contributor } from "../models/contributor.js";
import { Dependency } from "../models/dependency.js";
import { Deployment } from "../models/deployment.js";
import { HealthScore } from "../models/health.js";
import { Issue } from "../models/issue.js";
import { PullRequest, PullRequestReview } from "../models/pullRequest.js";
import { Release } from "../models/release.js";
import { Repository } from "../models/repository.js";
import { SecurityAlert } from "../models/securityAlert.js";
import { WorkflowRun } from "../models/workflow.js";
import { cacheKeys, withCache } from "../lib/cache.js";
import { healthService } from "./healthService.js";

export type Scope = { workspaceId: string; repositoryId?: string };

export interface ActivityItem {
  id: string;
  at: Date;
  type: string;
  repositoryId?: string;
  repositoryName?: string;
  title: string;
  subtitle?: string;
  meta?: Record<string, unknown>;
}

const RANGE_DAYS: Record<Range, number> = { "7D": 7, "14D": 14, "30D": 30, "90D": 90 };
export const DEFAULT_RANGE: Range = "30D";

function rangeDays(range: Range): number {
  return RANGE_DAYS[range] ?? 30;
}

function sinceDate(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function bucketSize(days: number): number {
  if (days <= 14) return 1;
  if (days <= 60) return 1;
  return 7;
}

function buildBuckets(days: number): { start: Date; end: Date }[] {
  const size = bucketSize(days);
  const buckets: { start: Date; end: Date }[] = [];
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  for (let d = start.getTime(); d <= now.getTime(); d += size * 86_400_000) {
    buckets.push({
      start: new Date(d),
      end: new Date(Math.min(d + size * 86_400_000, now.getTime() + 86_400_000)),
    });
  }
  return buckets;
}

function bucketDate(bucket: { start: Date }): string {
  return bucket.start.toISOString().slice(0, 10);
}

async function repositoryIds(scope: Scope): Promise<string[]> {
  const filter: Record<string, unknown> = { workspaceId: scope.workspaceId, enabled: true };
  const repos = await Repository.find(filter).select("_id").lean().exec();
  return repos.map((r) => r._id.toString());
}

function repoFilter(scope: Scope, ids: string[]): Record<string, unknown> {
  return scope.repositoryId ? { repositoryId: scope.repositoryId } : { repositoryId: { $in: ids } };
}

function oid(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

export class AnalyticsService {
  /* ── Commit analytics ─────────────────────────────────── */

  async commitAnalytics(scope: Scope, range: Range = DEFAULT_RANGE) {
    const ids = await repositoryIds(scope);
    const filter = repoFilter(scope, ids);
    const days = rangeDays(range);
    const since = sinceDate(days);
    const inRange = { ...filter, date: { $gte: since } };

    const today = sinceDate(1);
    const week = sinceDate(7);
    const month = sinceDate(30);

    const [todayCount, weekCount, monthCount, commits, classification, contributors] =
      await Promise.all([
        Commit.countDocuments({ ...inRange, date: { $gte: today } }).lean(),
        Commit.countDocuments({ ...inRange, date: { $gte: week } }).lean(),
        Commit.countDocuments({ ...inRange, date: { $gte: month } }).lean(),
        Commit.find(inRange).select("date").lean().exec(),
        Commit.aggregate([
          { $match: inRange },
          { $group: { _id: "$classification", count: { $sum: 1 } } },
        ]),
        Commit.aggregate<{ _id: string; commits: number; additions: number; deletions: number }>([
          { $match: inRange },
          {
            $group: {
              _id: "$authorLogin",
              commits: { $sum: 1 },
              additions: { $sum: "$additions" },
              deletions: { $sum: "$deletions" },
            },
          },
          { $sort: { commits: -1 } },
          { $limit: 12 },
        ]),
        Commit.aggregate([
          { $match: inRange },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
              commits: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    const activity = this.seriesFromCounts(days, commits.map((c) => ({ date: c.date, count: 1 })));

    return {
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
      activity,
      classification: classification.map((c) => ({ classification: c._id, count: c.count })),
      contributors: contributors.map((c) => ({
        login: c._id,
        commits: c.commits,
        additions: c.additions,
        deletions: c.deletions,
      })),
      weeklyDistribution: activity,
    };
  }

  /* ── PR analytics ─────────────────────────────────────── */

  async pullRequestAnalytics(scope: Scope, range: Range = DEFAULT_RANGE) {
    const ids = await repositoryIds(scope);
    const filter = repoFilter(scope, ids);
    const days = rangeDays(range);
    const since = sinceDate(days);

    const merged = await PullRequest.find({ ...filter, state: "MERGED", mergedAt: { $gte: since } })
      .select("createdAt mergedAt reviewTimeMs approvalTimeMs mergeTimeMs riskLevel")
      .lean()
      .exec();
    const all = await PullRequest.find(filter).select("state riskLevel").lean().exec();

    const mergedCount = merged.length;
    const avg = (get: (p: (typeof merged)[number]) => number | undefined) => {
      const vals = merged.map(get).filter((v): v is number => typeof v === "number" && v > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    const cycleTimeSeries = await this.prCycleSeries(filter, days);

    const riskDist: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const p of all) {
      const level = (p.riskLevel as string) ?? "LOW";
      riskDist[level] = (riskDist[level] ?? 0) + 1;
    }

    return {
      openCount: all.filter((p) => p.state === "OPEN").length,
      mergedCount,
      averageCycleTimeMs: avg((p) => p.mergeTimeMs && p.reviewTimeMs ? p.mergeTimeMs + p.reviewTimeMs : undefined) || avg((p) =>
        p.mergedAt ? new Date(p.mergedAt).getTime() - new Date(p.createdAt).getTime() : undefined,
      ),
      averageReviewTimeMs: avg((p) => p.reviewTimeMs),
      averageMergeTimeMs: avg((p) => p.mergeTimeMs),
      mergeRate: all.length ? mergedCount / all.length : 0,
      cycleTimeSeries,
      riskDistribution: Object.entries(riskDist).map(([level, count]) => ({ level, count })),
    };
  }

  /* ── Issue analytics ──────────────────────────────────── */

  async issueAnalytics(scope: Scope, range: Range = DEFAULT_RANGE) {
    const ids = await repositoryIds(scope);
    const filter = repoFilter(scope, ids);
    const days = rangeDays(range);
    const since = sinceDate(days);

    const issues = await Issue.find(filter)
      .select("state createdAt closedAt updatedAt labels")
      .lean()
      .exec();

    const open = issues.filter((i) => i.state === "OPEN");
    const stale = open.filter((i) => Date.now() - new Date(i.updatedAt ?? i.createdAt).getTime() > 30 * 86_400_000);
    const critical = open.filter((i) => (i.labels ?? []).some((l) => l.toLowerCase().includes("critical") || l.toLowerCase().includes("security")));
    const closed = issues.filter((i) => i.state === "CLOSED");

    const avgAge = open.length
      ? open.reduce((n, i) => n + (Date.now() - new Date(i.createdAt).getTime()) / 86_400_000, 0) / open.length
      : 0;
    const avgResolution = closed.length
      ? closed
          .filter((i) => i.closedAt)
          .reduce((n, i) => n + (new Date(i.closedAt!).getTime() - new Date(i.createdAt).getTime()) / 86_400_000, 0) /
        closed.filter((i) => i.closedAt).length
      : 0;

    const closedInRange = closed.filter((i) => i.closedAt && new Date(i.closedAt) >= since);
    const resolutionSeries = this.seriesFromCounts(days, closedInRange.map((i) => ({ date: i.closedAt!, count: 1 }))).map(({ date, commits }) => ({ date, issuesClosed: commits }));

    return {
      open: open.length,
      closed: closed.length,
      stale: stale.length,
      critical: critical.length,
      averageAgeDays: Math.round(avgAge * 10) / 10,
      averageResolutionDays: Math.round(avgResolution * 10) / 10,
      resolutionSeries,
    };
  }

  /* ── Dependency analytics ─────────────────────────────── */

  async dependencyAnalytics(scope: Scope) {
    const ids = await repositoryIds(scope);
    const filter = repoFilter(scope, ids);
    const deps = await Dependency.find(filter)
      .select("updateType risk vulnerabilities outdated name ecosystem repositoryId currentVersion latestVersion")
      .lean()
      .exec();

    const buckets: Record<string, number> = { NONE: 0, PATCH: 0, MINOR: 0, MAJOR: 0 };
    for (const d of deps) buckets[d.updateType] = (buckets[d.updateType] ?? 0) + 1;

    const severityBuckets: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const d of deps) {
      for (const v of d.vulnerabilities) {
        severityBuckets[v.severity] = (severityBuckets[v.severity] ?? 0) + 1;
      }
    }

    const topOutdated = deps
      .filter((d) => d.outdated)
      .sort((a, b) => {
        const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (rank[b.risk] ?? 0) - (rank[a.risk] ?? 0);
      })
      .slice(0, 10);

    return {
      total: deps.length,
      outdated: deps.filter((d) => d.outdated).length,
      vulnerable: deps.filter((d) => d.vulnerabilities.length > 0).length,
      critical: deps.filter((d) => d.risk === "CRITICAL" || d.vulnerabilities.some((v) => v.severity === "CRITICAL")).length,
      byUpdateType: Object.entries(buckets).map(([updateType, count]) => ({ updateType, count })),
      bySeverity: Object.entries(severityBuckets).map(([severity, count]) => ({ severity, count })),
      topOutdated,
    };
  }

  /* ── Security analytics ───────────────────────────────── */

  async securityAnalytics(scope: Scope) {
    const ids = await repositoryIds(scope);
    const filter = repoFilter(scope, ids);
    const alerts = await SecurityAlert.find(filter)
      .select("state severity type title createdAt repositoryId")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec();

    const open = alerts.filter((a) => a.state === "OPEN");
    const buckets: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const a of open) buckets[a.severity] = (buckets[a.severity] ?? 0) + 1;

    const categoryBuckets: Record<string, number> = {};
    for (const a of alerts) {
      categoryBuckets[a.type] = (categoryBuckets[a.type] ?? 0) + 1;
    }

    const penalty: Record<string, number> = { CRITICAL: 22, HIGH: 13, MEDIUM: 6, LOW: 2, INFO: 0 };
    const score = clamp(
      100 - open.reduce((n, a) => n + (penalty[a.severity] ?? 0), 0),
      0,
      100,
    );

    return {
      score: Math.round(score),
      critical: buckets.CRITICAL,
      high: buckets.HIGH,
      medium: buckets.MEDIUM,
      low: buckets.LOW,
      open: open.length,
      fixed: alerts.length - open.length,
      byCategory: Object.entries(categoryBuckets).map(([category, count]) => ({ category, count })),
      recent: alerts.slice(0, 8),
    };
  }

  /* ── CI/CD analytics ──────────────────────────────────── */

  async cicdAnalytics(scope: Scope, range: Range = DEFAULT_RANGE) {
    const ids = await repositoryIds(scope);
    const filter = repoFilter(scope, ids);
    const days = rangeDays(range);
    const since = sinceDate(days);

    const runs = await WorkflowRun.find({ ...filter, createdAt: { $gte: since } })
      .select("status createdAt durationMs steps")
      .lean()
      .exec();

    const successful = runs.filter((r) => r.status === "SUCCESS" || r.status === "COMPLETED" || r.status === "NEUTRAL");
    const failed = runs.filter((r) => r.status === "FAILURE" || r.status === "CANCELLED" || r.status === "ACTION_REQUIRED");
    const successRate = runs.length ? successful.length / runs.length : 0;
    const avgBuild = successful.filter((r) => r.durationMs).reduce((n, r) => n + (r.durationMs ?? 0), 0) / Math.max(1, successful.filter((r) => r.durationMs).length);

    const stageStats = new Map<string, { name: string; status: string; totalMs: number; count: number }>();
    for (const run of runs) {
      for (const step of run.steps ?? []) {
        const key = step.name;
        const stat = stageStats.get(key) ?? { name: key, status: step.status, totalMs: 0, count: 0 };
        stat.totalMs += step.durationMs ?? 0;
        stat.count += 1;
        if (step.conclusion === "failure") stat.status = "failure";
        stageStats.set(key, stat);
      }
    }

    const deployments = await Deployment.countDocuments({ ...filter, createdAt: { $gte: since } }).lean();

    return {
      buildSuccessRate: Math.round(successRate * 100) / 100,
      averageBuildTimeMs: avgBuild,
      failedRuns: failed.length,
      successfulRuns: successful.length,
      totalRuns: runs.length,
      deployments,
      successSeries: this.seriesFromCounts(
        days,
        runs.map((r) => ({ date: r.createdAt, count: r.status === "SUCCESS" || r.status === "COMPLETED" || r.status === "NEUTRAL" ? 1 : 0 })),
      ),
      pipelineStages: [...stageStats.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ name: s.name, status: s.status, averageMs: s.count ? s.totalMs / s.count : 0, count: s.count })),
    };
  }

  /* ── Deployment analytics ─────────────────────────────── */

  async deploymentAnalytics(scope: Scope, range: Range = DEFAULT_RANGE) {
    const ids = await repositoryIds(scope);
    const filter = repoFilter(scope, ids);
    const days = rangeDays(range);
    const since = sinceDate(days);

    const deployments = await Deployment.find({ ...filter, createdAt: { $gte: since } })
      .select("status environment createdAt")
      .lean()
      .exec();

    const envBuckets: Record<string, number> = {};
    for (const d of deployments) {
      envBuckets[d.environment] = (envBuckets[d.environment] ?? 0) + 1;
    }

    return {
      total: deployments.length,
      successful: deployments.filter((d) => d.status === "SUCCESS").length,
      failed: deployments.filter((d) => d.status === "FAILURE").length,
      byEnvironment: Object.entries(envBuckets).map(([environment, count]) => ({ environment, count })),
      series: this.seriesFromCounts(days, deployments.map((d) => ({ date: d.createdAt, count: 1 }))).map(({ date, commits }) => ({ date, deployments: commits })),
      averageTimeToDeployMs: 0,
    };
  }

  /* ── Release analytics ────────────────────────────────── */

  async releaseAnalytics(scope: Scope, range: Range = DEFAULT_RANGE) {
    const ids = await repositoryIds(scope);
    const filter = repoFilter(scope, ids);
    const days = rangeDays(range);
    const since = sinceDate(days);

    const releases = await Release.find({ ...filter, publishedAt: { $gte: since } })
      .select("publishedAt isPrerelease commitCount")
      .sort({ publishedAt: -1 })
      .lean()
      .exec();

    const latest = await Release.find(filter).sort({ publishedAt: -1 }).limit(6).lean().exec();

    return {
      total: releases.length,
      prereleases: releases.filter((r) => r.isPrerelease).length,
      averageCommits: releases.length ? releases.reduce((n, r) => n + r.commitCount, 0) / releases.length : 0,
      series: this.seriesFromCounts(days, releases.map((r) => ({ date: r.publishedAt, count: 1 }))).map(({ date, commits }) => ({ date, releases: commits })),
      latest,
    };
  }

  /* ── Contributor analytics ────────────────────────────── */

  async contributorAnalytics(scope: Scope, range: Range = DEFAULT_RANGE) {
    const ids = await repositoryIds(scope);
    const filter = repoFilter(scope, ids);
    const days = rangeDays(range);
    const since = sinceDate(days);

    const contributors = await Contributor.find(filter).lean().exec();
    const commits = await Commit.find({ ...filter, date: { $gte: since } }).select("authorLogin additions deletions date").lean().exec();

    const perAuthor = new Map<string, { login: string; commits: number; additions: number; deletions: number }>();
    for (const c of commits) {
      const entry = perAuthor.get(c.authorLogin) ?? { login: c.authorLogin, commits: 0, additions: 0, deletions: 0 };
      entry.commits += 1;
      entry.additions += c.additions;
      entry.deletions += c.deletions;
      perAuthor.set(c.authorLogin, entry);
    }

    // Bus factor: fewest contributors responsible for 50% of commits
    const sorted = [...perAuthor.values()].sort((a, b) => b.commits - a.commits);
    const totalCommits = sorted.reduce((n, c) => n + c.commits, 0);
    let busFactor = sorted.length;
    let accumulated = 0;
    for (let i = 0; i < sorted.length; i++) {
      accumulated += sorted[i]!.commits;
      if (accumulated >= totalCommits / 2) {
        busFactor = i + 1;
        break;
      }
    }

    const active30d = new Set(
      commits.filter((c) => new Date(c.date) >= sinceDate(30)).map((c) => c.authorLogin),
    ).size;

    return {
      total: contributors.length,
      active30d,
      totalCommits,
      totalAdditions: commits.reduce((n, c) => n + c.additions, 0),
      totalDeletions: commits.reduce((n, c) => n + c.deletions, 0),
      commitsByAuthor: [...perAuthor.values()].sort((a, b) => b.commits - a.commits).slice(0, 12),
      activitySeries: this.seriesFromCounts(days, commits.map((c) => ({ date: c.date, count: 1 }))),
      busFactor,
    };
  }

  /* ── Delivery funnel ──────────────────────────────────── */

  async deliveryAnalytics(scope: Scope, range: Range = DEFAULT_RANGE) {
    const ids = await repositoryIds(scope);
    const filter = repoFilter(scope, ids);
    const days = rangeDays(range);
    const since = sinceDate(days);
    const previousSince = new Date(since.getTime() - days * 86_400_000);

    const prs = await PullRequest.find({ ...filter, state: "MERGED", mergedAt: { $gte: previousSince } })
      .select("createdAt authorLogin lifecycle repositoryId")
      .sort({ mergedAt: -1 })
      .limit(120)
      .lean()
      .exec();

    const stageAt = (pr: (typeof prs)[number], stage: string): Date | undefined => {
      const entry = (pr.lifecycle ?? []).find((l) => l.stage === stage);
      return entry?.at ? new Date(entry.at) : undefined;
    };

    // Commit → PR: author's most recent commit before PR creation
    const commitToPr: number[] = [];
    for (const pr of prs) {
      const prior = await Commit.findOne({
        repositoryId: pr.repositoryId,
        authorLogin: pr.authorLogin,
        date: { $lt: pr.createdAt },
      })
        .sort({ date: -1 })
        .select("date")
        .lean()
        .exec();
      if (prior) {
        commitToPr.push(new Date(pr.createdAt).getTime() - new Date(prior.date).getTime());
      }
    }

    const durations = {
      prToReview: this.gaps(prs, "created", "review"),
      reviewToApproval: this.gaps(prs, "review", "approved"),
      approvalToMerge: this.gaps(prs, "approved", "merged"),
      mergeToDeploy: this.gaps(prs, "merged", "deployed"),
    };

    // Deploy → Release: for each deployed PR, first release after deployment
    const deployToRelease: number[] = [];
    if (prs.length) {
      const repoIds = [...new Set(prs.map((p) => p.repositoryId.toString()))];
      const releases = await Release.find({ repositoryId: { $in: repoIds.map(oid) } })
        .sort({ publishedAt: 1 })
        .select("publishedAt repositoryId")
        .lean()
        .exec();
      for (const pr of prs) {
        const deployedAt = stageAt(pr, "deployed");
        if (!deployedAt) continue;
        const next = releases.find(
          (r) => r.repositoryId.toString() === pr.repositoryId.toString() && new Date(r.publishedAt) >= deployedAt,
        );
        if (next) deployToRelease.push(new Date(next.publishedAt).getTime() - deployedAt.getTime());
      }
    }

    // CI stage: gap between merge and first completed run
    const mergeToCi: number[] = [];
    if (prs.length) {
      const repoIds = [...new Set(prs.map((p) => p.repositoryId.toString()))];
      const runs = await WorkflowRun.find({
        repositoryId: { $in: repoIds.map(oid) },
        createdAt: { $gte: previousSince },
      })
        .sort({ createdAt: 1 })
        .select("createdAt repositoryId status")
        .lean()
        .exec();
      for (const pr of prs) {
        const mergedAt = stageAt(pr, "merged");
        if (!mergedAt) continue;
        const next = runs.find(
          (r) =>
            r.repositoryId.toString() === pr.repositoryId.toString() &&
            new Date(r.createdAt) >= mergedAt &&
            (r.status === "SUCCESS" || r.status === "COMPLETED"),
        );
        if (next) mergeToCi.push(new Date(next.createdAt).getTime() - mergedAt.getTime());
      }
    }

    const stages = [
      this.stage("Commit", "Pull Request", "commitToPr", commitToPr),
      this.stage("Pull Request", "Review", "prToReview", durations.prToReview),
      this.stage("Review", "Approval", "reviewToApproval", durations.reviewToApproval),
      this.stage("Approval", "Merge", "approvalToMerge", durations.approvalToMerge),
      this.stage("Merge", "CI", "mergeToCi", mergeToCi),
      this.stage("Merge", "Deploy", "mergeToDeploy", durations.mergeToDeploy),
      this.stage("Deploy", "Release", "deployToRelease", deployToRelease),
    ];

    const current = stages.filter((s) => s.count > 0).map((s) => s.averageMs);
    const currentCycleTimeMs = current.length ? current.reduce((a, b) => a + b, 0) : 0;

    // Previous period (same length, immediately before)
    const previousPrs = await PullRequest.find({
      ...filter,
      state: "MERGED",
      mergedAt: { $gte: new Date(previousSince.getTime() - days * 86_400_000), $lt: previousSince },
    })
      .select("createdAt lifecycle")
      .limit(120)
      .lean()
      .exec();
    const previousStages = [
      this.stage("Commit", "Pull Request", "commitToPr", []),
      this.stage("Pull Request", "Review", "prToReview", this.gaps(previousPrs, "created", "review")),
      this.stage("Review", "Approval", "reviewToApproval", this.gaps(previousPrs, "review", "approved")),
      this.stage("Approval", "Merge", "approvalToMerge", this.gaps(previousPrs, "approved", "merged")),
      this.stage("Merge", "Deploy", "mergeToDeploy", this.gaps(previousPrs, "merged", "deployed")),
    ];
    const prevVals = previousStages.filter((s) => s.count > 0).map((s) => s.averageMs);
    const previousCycleTimeMs = prevVals.length ? prevVals.reduce((a, b) => a + b, 0) : currentCycleTimeMs;

    const cycleTimeChangePct = previousCycleTimeMs
      ? ((currentCycleTimeMs - previousCycleTimeMs) / previousCycleTimeMs) * 100
      : 0;

    const withChange = stages.map((stage) => {
      const previous = previousStages.find((p) => p.from === stage.from && p.to === stage.to);
      const changePct =
        previous && previous.count > 0 && previous.averageMs > 0
          ? ((stage.averageMs - previous.averageMs) / previous.averageMs) * 100
          : undefined;
      return { ...stage, changePct: changePct === undefined ? null : Math.round(changePct * 10) / 10 };
    });

    const bottleneck =
      [...withChange]
        .filter((s) => s.count > 0 && typeof s.changePct === "number" && s.changePct > 15)
        .sort((a, b) => (b.changePct as number) - (a.changePct as number))[0] ??
      [...withChange].filter((s) => s.count > 0).sort((a, b) => b.averageMs - a.averageMs)[0] ??
      null;

    return {
      stages: withChange,
      bottleneck,
      currentCycleTimeMs,
      previousCycleTimeMs,
      cycleTimeChangePct: Math.round(cycleTimeChangePct * 10) / 10,
    };
  }

  private gaps(
    prs: { lifecycle?: { stage: string; at?: Date }[]; createdAt: Date }[],
    fromStage: string,
    toStage: string,
  ): number[] {
    const out: number[] = [];
    for (const pr of prs) {
      const from = pr.lifecycle?.find((l) => l.stage === fromStage)?.at;
      const to = pr.lifecycle?.find((l) => l.stage === toStage)?.at;
      if (from && to) {
        const gap = new Date(to).getTime() - new Date(from).getTime();
        if (gap > 0) out.push(gap);
      }
    }
    return out;
  }

  private stage(stage: string, to: string, key: string, gaps: number[]) {
    return {
      stage,
      from: stage.toLowerCase().replace(" ", "-"),
      to: key,
      averageMs: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0,
      count: gaps.length,
    };
  }

  /* ── Repository comparison ────────────────────────────── */

  async repositoryComparison(scope: Scope, range: Range = DEFAULT_RANGE) {
    const days = rangeDays(range);
    const since = sinceDate(days);
    const repos = await Repository.find({ workspaceId: scope.workspaceId, enabled: true })
      .select("_id name")
      .lean()
      .exec();
    const ids = repos.map((r) => r._id.toString());

    const [commits, prs, issues, runs, contributors, health] = await Promise.all([
      Commit.aggregate([
        { $match: { repositoryId: { $in: ids.map(oid) }, date: { $gte: since } } },
        { $group: { _id: "$repositoryId", count: { $sum: 1 } } },
      ]),
      PullRequest.aggregate([
        { $match: { repositoryId: { $in: ids.map(oid) }, createdAt: { $gte: since } } },
        { $group: { _id: "$repositoryId", count: { $sum: 1 } } },
      ]),
      Issue.aggregate([
        { $match: { repositoryId: { $in: ids.map(oid) } } },
        {
          $group: {
            _id: "$repositoryId",
            open: { $sum: { $cond: [{ $eq: ["$state", "OPEN"] }, 1, 0] } },
            stale: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$state", "OPEN"] },
                      { $lt: ["$updatedAt", new Date(Date.now() - 30 * 86_400_000)] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      WorkflowRun.aggregate([
        { $match: { repositoryId: { $in: ids.map(oid) }, createdAt: { $gte: since } } },
        {
          $group: {
            _id: "$repositoryId",
            total: { $sum: 1 },
            success: { $sum: { $cond: [{ $in: ["$status", ["SUCCESS", "COMPLETED", "NEUTRAL"]] }, 1, 0] } },
          },
        },
      ]),
      Contributor.aggregate([
        { $match: { repositoryId: { $in: ids.map(oid) } } },
        { $group: { _id: "$repositoryId", count: { $sum: 1 } } },
      ]),
      HealthScore.aggregate([
        { $match: { repositoryId: { $in: ids.map(oid) } } },
        { $sort: { computedAt: -1 } },
        { $group: { _id: "$repositoryId", overall: { $first: "$overall" } } },
      ]),
    ]);

    const count = (rows: { _id: Types.ObjectId; count: number }[], id: string): number =>
      rows.find((r) => r._id.toString() === id)?.count ?? 0;

    return repos.map((repo) => {
      const id = repo._id.toString();
      const ci = runs.find((r) => r._id.toString() === id);
      return {
        repositoryId: id,
        name: repo.name,
        health: health.find((h) => h._id.toString() === id)?.overall ?? 0,
        commits: count(commits, id),
        pullRequests: count(prs, id),
        cycleTimeMs: 0,
        buildSuccessRate: ci?.total ? ci.success / ci.total : 0,
        contributors: count(contributors, id),
        openIssues: issues.find((i) => i._id.toString() === id)?.open ?? 0,
        staleIssues: issues.find((i) => i._id.toString() === id)?.stale ?? 0,
      };
    });
  }

  /* ── Engineering overview (workspace) ─────────────────── */

  async engineeringOverview(workspaceId: string) {
    return withCache(cacheKeys.overview(workspaceId), 60, async () => {
      const repos = await Repository.find({ workspaceId, enabled: true }).select("_id name").lean().exec();
      const ids = repos.map((r) => r._id.toString());
      const inRepos = { repositoryId: { $in: ids.map(oid) } };

      const [health, openPrs, openIssues, deployments, security, commits30d, recentDeployments, activity] =
        await Promise.all([
          healthService.workspaceHealth(workspaceId),
          PullRequest.countDocuments({ ...inRepos, state: "OPEN" }).lean(),
          Issue.countDocuments({ ...inRepos, state: "OPEN" }).lean(),
          Deployment.countDocuments({ ...inRepos, createdAt: { $gte: sinceDate(30) } }).lean(),
          SecurityAlert.countDocuments({ ...inRepos, state: "OPEN" }).lean(),
          Commit.countDocuments({ ...inRepos, date: { $gte: sinceDate(30) } }).lean(),
          Deployment.find(inRepos).sort({ createdAt: -1 }).limit(6).lean().exec(),
          this.engineeringActivity(workspaceId, { filters: ["ALL"], limit: 12 }),
        ]);

      return {
        health: health.health,
        healthChange: health.change,
        repositories: repos.length,
        openPrs,
        openIssues,
        deployments,
        securityAlerts: security,
        commits30d,
        healthTrend: await this.healthTrendForWorkspace(workspaceId),
        activity: this.toActivityConnection(activity.items, activity.hasMore),
        recentDeployments,
        topRisks: [],
        bottleneck: null,
        recommendations: [],
      };
    });
  }

  private toActivityConnection(items: ActivityItem[], hasMore: boolean) {
    const cursorOf = (at: Date) => Buffer.from(at.toISOString(), "utf8").toString("base64url");
    const first = items[0];
    const last = items[items.length - 1];
    return {
      edges: items.map((item) => ({
        node: {
          id: item.id,
          at: item.at,
          type: item.type,
          repositoryId: item.repositoryId,
          repositoryName: item.repositoryName,
          title: item.title,
          subtitle: item.subtitle,
          meta: item.meta,
        },
        cursor: cursorOf(item.at),
      })),
      pageInfo: {
        hasNextPage: hasMore,
        hasPreviousPage: false,
        startCursor: first ? cursorOf(first.at) : null,
        endCursor: last ? cursorOf(last.at) : null,
      },
      totalCount: items.length,
    };
  }

  async healthTrendForWorkspace(workspaceId: string): Promise<{ date: Date; score: number }[]> {
    const repos = await Repository.find({ workspaceId }).select("_id").lean().exec();
    const ids = repos.map((r) => r._id.toString());
    if (!ids.length) return [];
    const snapshots = await HealthScore.find({
      repositoryId: { $in: ids.map(oid) },
      computedAt: { $gte: sinceDate(90) },
    })
      .select("overall computedAt")
      .sort({ computedAt: -1 })
      .lean()
      .exec();
    const weekly = new Map<string, { total: number; count: number }>();
    for (const s of snapshots) {
      const key = new Date(s.computedAt).toISOString().slice(0, 10);
      const entry = weekly.get(key) ?? { total: 0, count: 0 };
      entry.total += s.overall;
      entry.count += 1;
      weekly.set(key, entry);
    }
    return [...weekly.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([date, entry]) => ({ date: new Date(date), score: Math.round(entry.total / entry.count) }));
  }

  /* ── Activity timeline ────────────────────────────────── */

  async engineeringActivity(
    workspaceId: string,
    opts: { filters?: ActivityFilter[]; limit?: number; after?: string; before?: string },
  ): Promise<{ items: ActivityItem[]; hasMore: boolean }> {
    const filters = opts.filters?.includes("ALL") || !opts.filters?.length ? ["ALL"] : opts.filters;
    const afterDate = opts.after ? new Date(opts.after) : undefined;
    const beforeDate = opts.before ? new Date(opts.before) : undefined;
    const limit = opts.limit ?? 30;
    const repos = await Repository.find({ workspaceId, enabled: true }).select("_id name").lean().exec();
    const ids = repos.map((r) => r._id.toString());
    const nameById = new Map(repos.map((r) => [r._id.toString(), r.name]));
    const inRepos = { repositoryId: { $in: ids.map(oid) } };

    const items: ActivityItem[] = [];

    const push = <T extends { _id: unknown; createdAt?: Date; date?: Date; publishedAt?: Date; submittedAt?: Date }>(
      type: string,
      rows: T[],
      getTitle: (row: T) => string,
      getSubtitle?: (row: T) => string | undefined,
      idOf?: (row: T) => string,
    ) => {
      for (const row of rows) {
        const at = row.date ?? row.createdAt ?? row.publishedAt ?? row.submittedAt;
        if (!at) continue;
        const repositoryId = (row as unknown as { repositoryId?: { toString(): string } }).repositoryId?.toString();
        items.push({
          id: idOf ? idOf(row) : row._id != null ? `${type}-${String(row._id)}` : `${type}-${String(at.getTime())}`,
          at,
          type,
          repositoryId,
          repositoryName: repositoryId ? nameById.get(repositoryId) : undefined,
          title: getTitle(row),
          subtitle: getSubtitle?.(row),
        });
      }
    };

    const wants = (f: string) => filters.includes("ALL") || filters.includes(f as ActivityFilter);

    if (wants("COMMITS")) {
      const rows = await Commit.find(inRepos).sort({ date: -1 }).limit(limit).select("date messageTitle authorLogin").lean().exec();
      push("COMMITS", rows, (r) => r.messageTitle, (r) => r.authorLogin);
    }
    if (wants("PRS")) {
      const rows = await PullRequest.find(inRepos).sort({ createdAt: -1 }).limit(limit).select("createdAt githubNumber title state authorLogin repositoryId").lean().exec();
      push("PRS", rows, (r) => `PR #${r.githubNumber} ${r.title}`, (r) => `${r.state.toLowerCase()} by ${r.authorLogin}`);
    }
    if (wants("REVIEWS")) {
      const prs = await PullRequest.find(inRepos).select("_id repositoryId githubNumber").lean().exec();
      const prIds = prs.map((p) => p._id);
      const prMap = new Map(prs.map((p) => [p._id.toString(), p]));

      const rows = await PullRequestReview.find({ pullRequestId: { $in: prIds } })
        .sort({ submittedAt: -1 })
        .limit(limit)
        .lean()
        .exec();

      const rowsWithPr = rows.map((r) => {
        const pr = prMap.get(r.pullRequestId.toString());
        return {
          ...r,
          repositoryId: pr?.repositoryId,
        };
      });

      push(
        "REVIEWS",
        rowsWithPr,
        (r) => `Review on PR #${prMap.get(r.pullRequestId.toString())?.githubNumber ?? ""}: ${r.state.toLowerCase()} by ${r.reviewerLogin}`,
        (r) => r.body,
      );
    }
    if (wants("ISSUES")) {
      const rows = await Issue.find(inRepos).sort({ createdAt: -1 }).limit(limit).select("createdAt githubNumber title state authorLogin repositoryId").lean().exec();
      push("ISSUES", rows, (r) => `Issue #${r.githubNumber} ${r.title}`, (r) => `${r.state.toLowerCase()} by ${r.authorLogin}`);
    }
    if (wants("DEPLOYMENTS")) {
      const rows = await Deployment.find(inRepos).sort({ createdAt: -1 }).limit(limit).select("createdAt environment status version creatorLogin repositoryId").lean().exec();
      push("DEPLOYMENTS", rows, (r) => `Deployment ${r.version ?? ""} ${r.status.toLowerCase()}`, (r) => `${r.environment} · ${r.creatorLogin}`);
    }
    if (wants("RELEASES")) {
      const rows = await Release.find(inRepos).sort({ publishedAt: -1 }).limit(limit).select("publishedAt tagName repositoryId").lean().exec();
      push("RELEASES", rows, (r) => `Release ${r.tagName}`, () => undefined);
    }
    if (wants("SECURITY")) {
      const rows = await SecurityAlert.find(inRepos).sort({ createdAt: -1 }).limit(limit).select("createdAt title severity state repositoryId").lean().exec();
      push("SECURITY", rows, (r) => r.title, (r) => `${r.severity} ${r.state.toLowerCase()}`);
    }
    if (wants("CI")) {
      const rows = await WorkflowRun.find(inRepos).sort({ createdAt: -1 }).limit(limit).select("createdAt workflowName status runNumber branch repositoryId").lean().exec();
      push("CI", rows, (r) => `${r.workflowName} #${r.runNumber} ${r.status.toLowerCase()}`, (r) => r.branch);
    }

    items.sort((a, b) => b.at.getTime() - a.at.getTime());
    const filtered = items.filter((item) => {
      if (afterDate && item.at.getTime() > afterDate.getTime()) return false;
      if (beforeDate && item.at.getTime() < beforeDate.getTime()) return false;
      return true;
    });
    const sliced = filtered.slice(0, limit);
    return { items: sliced, hasMore: filtered.length > limit };
  }

  private seriesFromCounts(days: number, rows: { date: Date | string; count: number }[]): { date: string; commits: number }[] {
    const buckets = buildBuckets(days);
    const counts = new Map(buckets.map((b) => [bucketDate(b), 0]));
    for (const row of rows) {
      const key = new Date(row.date).toISOString().slice(0, 10);
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + row.count);
    }
    return buckets.map((b) => ({ date: bucketDate(b), commits: counts.get(bucketDate(b)) ?? 0 }));
  }

  private async prCycleSeries(filter: Record<string, unknown>, days: number): Promise<{ date: string; pullRequests: number }[]> {
    const since = sinceDate(days);
    const merged = await PullRequest.find({ ...filter, state: "MERGED", mergedAt: { $gte: since } })
      .select("createdAt mergedAt")
      .lean()
      .exec();
    const buckets = buildBuckets(days);
    const byDay = new Map<string, number[]>();
    for (const pr of merged) {
      const gap = new Date(pr.mergedAt!).getTime() - new Date(pr.createdAt).getTime();
      const key = new Date(pr.mergedAt!).toISOString().slice(0, 10);
      const arr = byDay.get(key) ?? [];
      arr.push(gap);
      byDay.set(key, arr);
    }
    return buckets.map((b) => {
      const key = bucketDate(b);
      const vals = byDay.get(key) ?? [];
      return { date: key, pullRequests: vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : 0 };
    });
  }
}

export const analyticsService = new AnalyticsService();
