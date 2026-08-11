import { Types } from "mongoose";
import { HEALTH_CATEGORIES, HEALTH_LABELS, HEALTH_WEIGHTS, daysSince, healthLabel } from "@parallax/shared";
import type { GraphQLContext } from "../context.js";
import { healthService } from "../../services/healthService.js";
import type { RepositoryDoc } from "../../models/repository.js";
import type { PullRequestDoc } from "../../models/pullRequest.js";
import type { IssueDoc } from "../../models/issue.js";
import type { ReleaseDoc } from "../../models/release.js";
import { paginate } from "../../lib/pagination.js";
import { analyticsService } from "../../services/analyticsService.js";

const oid = (id: string) => new Types.ObjectId(id);

type FieldResolver<TParent, TResult = unknown> = (parent: TParent, args: Record<string, never>, ctx: GraphQLContext) => TResult | Promise<TResult>;

export const typeFields = {
  /* ── User / Workspace ─────────────────────────────────── */

  Workspace: {
    owner: async (parent: { ownerId: unknown }, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.userById.load(String(parent.ownerId)),
    members: async (parent: { _id: unknown }, _args: unknown, _ctx: GraphQLContext) => {
      const { WorkspaceMember } = await import("../../models/workspace.js");
      return WorkspaceMember.find({ workspaceId: parent._id }).sort({ joinedAt: 1 }).lean().exec();
    },
    repositories: async (parent: { _id: unknown }, args: { pagination?: unknown }, _ctx: GraphQLContext) => {
      const { Repository } = await import("../../models/repository.js");
      return paginate(Repository, { workspaceId: String(parent._id), enabled: true }, (args.pagination ?? {}) as never, "createdAt");
    },
    health: async (parent: { _id: unknown }, _args: unknown, _ctx: GraphQLContext) => {
      const { health } = await healthService.workspaceHealth(String(parent._id));
      return health || null;
    },
    stats: async (parent: { _id: unknown }, _args: unknown, _ctx: GraphQLContext) => {
      const workspaceId = String(parent._id);
      const { Repository } = await import("../../models/repository.js");
      const { PullRequest } = await import("../../models/pullRequest.js");
      const { Issue } = await import("../../models/issue.js");
      const { Deployment } = await import("../../models/deployment.js");
      const { SecurityAlert } = await import("../../models/securityAlert.js");
      const repos = await Repository.find({ workspaceId }).select("_id").lean().exec();
      const inRepos = { repositoryId: { $in: repos.map((r) => oid(String(r._id))) } };
      const [repositories, openPrs, openIssues, deployments30d, securityAlerts] = await Promise.all([
        repos.length,
        PullRequest.countDocuments({ ...inRepos, state: "OPEN" }).lean(),
        Issue.countDocuments({ ...inRepos, state: "OPEN" }).lean(),
        Deployment.countDocuments({ ...inRepos, createdAt: { $gte: new Date(Date.now() - 30 * 86_400_000) } }).lean(),
        SecurityAlert.countDocuments({ ...inRepos, state: "OPEN" }).lean(),
      ]);
      return { repositories, openPrs, openIssues, deployments30d, securityAlerts };
    },
  },

  WorkspaceMember: {
    user: async (parent: { userId: unknown }, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.userById.load(String(parent.userId)),
  },

  /* ── Repository ───────────────────────────────────────── */

  Repository: {
    health: async (parent: RepositoryDoc, _args: unknown, ctx: GraphQLContext) => {
      const latest = (await ctx.loaders.repositoryHealth.load(String(parent._id))) as
        | { overall: number; change: number; computedAt: Date }
        | null;
      if (!latest) return null;
      return {
        repositoryId: String(parent._id),
        overall: latest.overall,
        change: latest.change,
        computedAt: latest.computedAt,
      };
    },
    counts: async (parent: RepositoryDoc, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.repositoryCounts.load(String(parent._id)),
    lastActivityAt: (parent: RepositoryDoc) => parent.lastActivityAt ?? parent.pushedAt ?? null,
  },

  /* ── Git history ──────────────────────────────────────── */

  Commit: {
    repository: async (parent: { repositoryId: unknown }, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.repositoryById.load(String(parent.repositoryId)),
    additions: (parent: { additions?: number }) => parent.additions ?? 0,
    deletions: (parent: { deletions?: number }) => parent.deletions ?? 0,
    filesChanged: (parent: { filesChanged?: number }) => parent.filesChanged ?? 0,
    isMerge: (parent: { isMerge?: boolean }) => parent.isMerge ?? false,
  },

  /* ── Pull requests ────────────────────────────────────── */

  PullRequest: {
    risk: (parent: PullRequestDoc) =>
      parent.riskScore === undefined || parent.riskScore === null
        ? null
        : {
            score: parent.riskScore,
            level: parent.riskLevel ?? "LOW",
            factors: parent.riskFactors ?? [],
            explanation: parent.riskExplanation ?? "",
          },
    reviews: async (parent: PullRequestDoc, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.prReviews.load(String(parent._id)),
    author: async (parent: PullRequestDoc, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.prAuthor.load(String(parent._id)),
    repository: async (parent: PullRequestDoc, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.repositoryById.load(String(parent.repositoryId)),
    lifecycle: (parent: PullRequestDoc) => parent.lifecycle ?? [],
    additions: (parent: PullRequestDoc) => parent.additions ?? 0,
    deletions: (parent: PullRequestDoc) => parent.deletions ?? 0,
    changedFiles: (parent: PullRequestDoc) => parent.changedFiles ?? 0,
    commits: (parent: PullRequestDoc) => parent.commits ?? 0,
    isDraft: (parent: PullRequestDoc) => parent.isDraft ?? false,
    labels: (parent: PullRequestDoc) => parent.labels ?? [],
  },

  /* ── Issues ───────────────────────────────────────────── */

  Issue: {
    daysInactive: (parent: IssueDoc) => daysSince(parent.updatedAt ?? parent.createdAt),
    isStale: (parent: IssueDoc) =>
      parent.state === "OPEN" && daysSince(parent.updatedAt ?? parent.createdAt) > 30,
    isCritical: (parent: IssueDoc) =>
      (parent.labels ?? []).some((l) => l.toLowerCase().includes("critical") || l.toLowerCase().includes("security")),
    repository: async (parent: IssueDoc, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.repositoryById.load(String(parent.repositoryId)),
    labels: (parent: IssueDoc) => parent.labels ?? [],
    assignees: (parent: IssueDoc) => parent.assignees ?? [],
    commentsCount: (parent: IssueDoc) => parent.commentsCount ?? 0,
  },

  /* ── Supply chain / security ──────────────────────────── */

  Dependency: {
    repository: async (parent: { repositoryId: unknown }, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.repositoryById.load(String(parent.repositoryId)),
  },

  SecurityAlert: {
    repository: async (parent: { repositoryId: unknown }, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.repositoryById.load(String(parent.repositoryId)),
  },

  WorkflowRun: {
    repository: async (parent: { repositoryId: unknown }, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.repositoryById.load(String(parent.repositoryId)),
  },

  Deployment: {
    repository: async (parent: { repositoryId: unknown }, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.repositoryById.load(String(parent.repositoryId)),
  },

  /* ── Releases ─────────────────────────────────────────── */

  Release: {
    health: (parent: ReleaseDoc) => {
      const features = parent.features.length;
      const bugFixes = parent.bugFixes.length;
      const breaking = parent.breakingChanges.length;
      const depChanges = parent.dependencyChanges.length;
      const commits = parent.commitCount;

      let score = 90;
      const explanationParts: string[] = [];
      if (commits > 40) {
        score -= 8;
        explanationParts.push("large change set");
      }
      if (breaking > 0) {
        score -= 10;
        explanationParts.push(`${breaking} breaking change${breaking > 1 ? "s" : ""}`);
      }
      if (depChanges > 2) {
        score -= 5;
        explanationParts.push("many dependency changes");
      }
      if (features === 0 && bugFixes === 0) {
        score -= 10;
        explanationParts.push("no user-facing changes");
      }
      if (parent.isPrerelease) {
        score -= 6;
        explanationParts.push("prerelease");
      }
      score = Math.max(0, Math.min(100, score));
      return {
        score,
        label: healthLabel(score),
        features,
        bugFixes,
        breakingChanges: breaking,
        dependencyChanges: depChanges,
        commitCount: commits,
        explanation: explanationParts.length ? explanationParts.join(", ") : "Stable, well-scoped release",
      };
    },
    repository: async (parent: ReleaseDoc, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.repositoryById.load(String(parent.repositoryId)),
  },

  /* ── Contributors ─────────────────────────────────────── */

  Contributor: {
    repository: async (parent: { repositoryId: unknown }, _args: unknown, ctx: GraphQLContext) =>
      ctx.loaders.repositoryById.load(String(parent.repositoryId)),
  },

  Recommendation: {
    repository: async (parent: { repositoryId?: unknown }, _args: unknown, ctx: GraphQLContext) =>
      parent.repositoryId ? ctx.loaders.repositoryById.load(String(parent.repositoryId)) : null,
  },

  /* ── Repository health ────────────────────────────────── */

  RepositoryHealth: {
    label: (parent: { overall: number }) => healthLabel(parent.overall),
    breakdown: async (parent: { repositoryId: string }) => {
      const latest = await healthService.getLatest(parent.repositoryId);
      if (!latest) return [];
      return HEALTH_CATEGORIES.map((key) => ({
        key,
        label: HEALTH_LABELS[key],
        score: latest.breakdown[key] ?? 0,
        weight: HEALTH_WEIGHTS[key],
      }));
    },
    trend: async (parent: { repositoryId: string }) => healthService.getTrend(parent.repositoryId),
    explanations: async (parent: { repositoryId: string }) => {
      const latest = await healthService.getLatest(parent.repositoryId);
      return latest?.explanations ?? [];
    },
    risks: async (parent: { repositoryId: string }) => {
      const latest = await healthService.getLatest(parent.repositoryId);
      return latest?.risks ?? [];
    },
  },

  /* ── Analytics helpers ────────────────────────────────── */

  EngineeringOverview: {
    topRisks: async (parent: { repositoryIds: string[] }) => {
      const { HealthScore } = await import("../../models/health.js");
      const latest = await HealthScore.find({
        repositoryId: { $in: parent.repositoryIds.map(oid) },
      })
        .sort({ computedAt: -1 })
        .limit(40)
        .lean()
        .exec();
      const seen = new Set<string>();
      const risks: string[] = [];
      for (const doc of latest) {
        for (const risk of doc.risks ?? []) {
          if (!seen.has(risk)) {
            seen.add(risk);
            risks.push(risk);
          }
          if (risks.length >= 5) break;
        }
        if (risks.length >= 5) break;
      }
      return risks;
    },
    bottleneck: async (parent: { workspaceId: string }) => {
      const funnel = await analyticsService.deliveryAnalytics({ workspaceId: parent.workspaceId }, "30D").catch(() => null);
      return funnel?.bottleneck?.stage ?? null;
    },
    recommendations: async (parent: { workspaceId: string }, _args: unknown, _ctx: GraphQLContext) => {
      const { Recommendation } = await import("../../models/recommendation.js");
      return Recommendation.find({ workspaceId: parent.workspaceId, status: "ACTIVE" })
        .sort({ priority: 1, createdAt: -1 })
        .limit(5)
        .lean()
        .exec();
    },
  },
};

export type { FieldResolver };
