import { Types } from "mongoose";
import { HEALTH_WEIGHTS, clamp, daysSince, healthLabel } from "@parallax/shared";
import { Commit } from "../models/commit.js";
import { Dependency } from "../models/dependency.js";
import { Deployment } from "../models/deployment.js";
import { HealthScore, type HealthScoreDoc } from "../models/health.js";
import { Issue } from "../models/issue.js";
import { PullRequest } from "../models/pullRequest.js";
import { Release } from "../models/release.js";
import { Repository } from "../models/repository.js";
import { SecurityAlert } from "../models/securityAlert.js";
import { WorkflowRun } from "../models/workflow.js";
import { cacheKeys, cacheSet } from "../lib/cache.js";

export interface HealthInput {
  repositoryId: string;
  workspaceId: string;
}

export interface HealthResult {
  overall: number;
  breakdown: Record<string, number>;
  change: number;
  explanations: string[];
  risks: string[];
}

const HEALTH_CACHE_TTL = 5 * 60; // 5 minutes

export class HealthService {
  async computeForRepository(input: HealthInput): Promise<HealthResult> {
    const { repositoryId, workspaceId } = input;
    const now = Date.now();

    const [commitCount, prs, issues, deps, alerts, deployments, releases, workflowRuns, previous] =
      await Promise.all([
        Commit.countDocuments({ repositoryId }).lean(),
        PullRequest.find({ repositoryId }).select("state createdAt mergedAt riskScore riskFactors testFilesChanged files").lean().exec(),
        Issue.find({ repositoryId }).select("state updatedAt labels createdAt closedAt").lean().exec(),
        Dependency.find({ repositoryId }).select("outdated updateType risk vulnerabilities").lean().exec(),
        SecurityAlert.find({ repositoryId }).select("state severity type").lean().exec(),
        Deployment.find({ repositoryId }).select("status createdAt").lean().exec(),
        Release.find({ repositoryId }).select("publishedAt").lean().exec(),
        WorkflowRun.find({ repositoryId }).select("status createdAt").lean().exec(),
        HealthScore.findOne({ repositoryId }).sort({ computedAt: -1 }).lean().exec(),
      ]);

    const days = 60 * 86_400_000;
    const recentPrs = prs.filter((p) => now - new Date(p.createdAt).getTime() < days);
    const recentMerged = recentPrs.filter((p) => p.state === "MERGED");

    /* ── Code Quality (20%) ─────────────────────────────── */
    const riskyShare =
      recentMerged.length > 0
        ? recentMerged.filter((p) => (p.riskScore ?? 0) >= 50 || (p.riskLevel as string) === "HIGH" || (p.riskLevel as string) === "CRITICAL").length / recentMerged.length
        : 0;
    const untestedShare =
      recentMerged.length > 0
        ? recentMerged.filter((p) => p.testFilesChanged === 0 && !(p.files ?? []).some((f) => f.includes("test"))).length / recentMerged.length
        : 0;
    const codeQuality = Math.round(clamp(92 - riskyShare * 60 - untestedShare * 25, 0, 100));

    /* ── Testing (15%) ──────────────────────────────────── */
    const testedShare =
      recentPrs.length > 0
        ? recentPrs.filter((p) => p.testFilesChanged > 0 || (p.files ?? []).some((f) => f.includes("test"))).length / recentPrs.length
        : 0;
    const testing = Math.round(clamp(35 + testedShare * 100, 0, 100));

    /* ── Dependencies (15%) ─────────────────────────────── */
    const outdatedShare = deps.length > 0 ? deps.filter((d) => d.outdated).length / deps.length : 0;
    const vulnCount = deps.reduce((n, d) => n + d.vulnerabilities.length, 0);
    const dependenciesScore = Math.round(clamp(100 - outdatedShare * 70 - vulnCount * 5, 0, 100));

    /* ── Security (15%) ─────────────────────────────────── */
    const openAlerts = alerts.filter((a) => a.state === "OPEN");
    const severityPenalty: Record<string, number> = { CRITICAL: 22, HIGH: 13, MEDIUM: 6, LOW: 2, INFO: 0 };
    const security = Math.round(
      clamp(100 - openAlerts.reduce((n, a) => n + (severityPenalty[a.severity] ?? 0), 0), 0, 100),
    );

    /* ── Documentation (5%) ─────────────────────────────── */
    const docsShare =
      commitCount > 0 ? await Commit.countDocuments({ repositoryId, classification: "docs" }).lean() / commitCount : 0;
    const documentation = Math.round(clamp(40 + (docsShare / 0.05) * 60, 0, 100));

    /* ── CI/CD (10%) ────────────────────────────────────── */
    const recentRuns = workflowRuns.filter((r) => now - new Date(r.createdAt).getTime() < 30 * 86_400_000);
    const successRate =
      recentRuns.length > 0
        ? recentRuns.filter((r) => r.status === "COMPLETED" || r.status === "SUCCESS" || r.status === "NEUTRAL").length / recentRuns.length
        : 0.5;
    const cicd = Math.round(clamp(successRate * 100, 0, 100));

    /* ── Activity (5%) ──────────────────────────────────── */
    const fourWeeksAgo = now - 28 * 86_400_000;
    const recentCommitCount = await Commit.countDocuments({
      repositoryId,
      date: { $gte: new Date(fourWeeksAgo) },
    }).lean();
    const expected = 32; // ~8 commits/week baseline
    const activity = Math.round(clamp((recentCommitCount / expected) * 100, 0, 100));

    /* ── Issue Hygiene (10%) ────────────────────────────── */
    const open = issues.filter((i) => i.state === "OPEN");
    const staleOpen = open.filter((i) => daysSince(i.updatedAt ?? i.createdAt) > 30);
    const criticalOpen = open.filter((i) => (i.labels ?? []).some((l) => l.toLowerCase().includes("critical") || l.toLowerCase().includes("security")));
    const issueHygiene = Math.round(
      clamp(100 - Math.min(50, (staleOpen.length / Math.max(1, open.length)) * 80) - criticalOpen.length * 6, 0, 100),
    );

    /* ── Release Stability (5%) ─────────────────────────── */
    const recentDeploys = deployments.filter((d) => now - new Date(d.createdAt).getTime() < 60 * 86_400_000);
    const failedShare =
      recentDeploys.length > 0 ? recentDeploys.filter((d) => d.status === "FAILURE").length / recentDeploys.length : 0;
    const recentReleases = releases.filter((r) => now - new Date(r.publishedAt).getTime() < 60 * 86_400_000);
    const releaseStability = Math.round(
      clamp(100 - failedShare * 300 - (recentReleases.length === 0 ? 20 : 0), 0, 100),
    );

    const breakdown = {
      codeQuality,
      testing,
      dependencies: dependenciesScore,
      security,
      documentation,
      cicd,
      activity,
      issueHygiene,
      releaseStability,
    };

    let overall = 0;
    for (const [key, weight] of Object.entries(HEALTH_WEIGHTS)) {
      overall += (breakdown[key as keyof typeof breakdown] ?? 0) * (weight / 100);
    }
    overall = Math.round(overall);

    const explanations: string[] = [];
    const risks: string[] = [];

    const outdatedDeps = deps.filter((d) => d.outdated).length;
    if (outdatedDeps > 0) {
      explanations.push(`${outdatedDeps} outdated ${outdatedDeps === 1 ? "dependency" : "dependencies"}`);
      risks.push("Dependency drift");
    }
    if (staleOpen.length > 0) {
      explanations.push(`${staleOpen.length} stale open ${staleOpen.length === 1 ? "issue" : "issues"}`);
      risks.push("Stale issue backlog");
    }
    if (failedShare > 0) {
      const failed = recentDeploys.filter((d) => d.status === "FAILURE").length;
      explanations.push(`${failed} failed production ${failed === 1 ? "deployment" : "deployments"}`);
      risks.push("Deployment instability");
    }
    if (vulnCount > 0) {
      explanations.push(`${vulnCount} known ${vulnCount === 1 ? "vulnerability" : "vulnerabilities"}`);
      risks.push("Supply chain vulnerabilities");
    }
    if (untestedShare > 0.4) {
      explanations.push(`${Math.round(untestedShare * 100)}% of merged PRs lack test changes`);
      risks.push("Testing coverage");
    }
    if (criticalOpen.length > 0) {
      explanations.push(`${criticalOpen.length} critical open ${criticalOpen.length === 1 ? "issue" : "issues"}`);
      risks.push("Critical issue backlog");
    }
    if (recentRuns.length > 0 && successRate < 0.85) {
      explanations.push(`CI success rate at ${Math.round(successRate * 100)}%`);
      risks.push("Flaky CI pipeline");
    }
    if (risks.length === 0) {
      risks.push("No material risks detected");
    }

    const change = previous ? overall - previous.overall : 0;
    if (previous && change !== 0) {
      explanations.unshift(
        change > 0
          ? `Health increased by ${change} points`
          : `Health decreased by ${Math.abs(change)} points`,
      );
    }

    const result: HealthResult = { overall, breakdown, change, explanations, risks };

    await HealthScore.create({
      repositoryId,
      workspaceId,
      overall,
      breakdown,
      change,
      explanations,
      risks,
      computedAt: new Date(),
    });

    await cacheSet(cacheKeys.health(repositoryId), result, HEALTH_CACHE_TTL);
    return result;
  }

  async getLatest(repositoryId: string): Promise<HealthScoreDoc | null> {
    return HealthScore.findOne({ repositoryId }).sort({ computedAt: -1 }).lean().exec();
  }

  async getTrend(repositoryId: string, points = 8): Promise<{ date: Date; score: number }[]> {
    const docs = await HealthScore.find({ repositoryId })
      .sort({ computedAt: -1 })
      .limit(points)
      .select("overall computedAt")
      .lean()
      .exec();
    return docs.reverse().map((d) => ({ date: d.computedAt, score: d.overall }));
  }

  /** Workspace-level average health from each repo's latest snapshot. */
  async workspaceHealth(workspaceId: string): Promise<{ health: number; change: number }> {
    const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
    const ids = repos.map((r) => r._id.toString());
    if (ids.length === 0) return { health: 0, change: 0 };
    const latest = await HealthScore.aggregate<{ overall: number; change: number }>([
      { $match: { repositoryId: { $in: ids.map((id) => new Types.ObjectId(id)) } } },
      { $sort: { computedAt: -1 } },
      {
        $group: {
          _id: "$repositoryId",
          overall: { $first: "$overall" },
          change: { $first: "$change" },
        },
      },
    ]);
    if (latest.length === 0) return { health: 0, change: 0 };
    const avg = latest.reduce((n, l) => n + l.overall, 0) / latest.length;
    const change = Math.round(latest.reduce((n, l) => n + l.change, 0) / latest.length);
    return { health: Math.round(avg), change };
  }

  static label(score: number): string {
    return healthLabel(score);
  }
}

export const healthService = new HealthService();
