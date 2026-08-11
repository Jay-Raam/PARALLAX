import { Types } from "mongoose";
import type { ZodTypeAny } from "zod";
import { prFiltersSchema, type Range } from "@parallax/shared";
import type { GraphQLContext } from "../context.js";
import { requireAuth, requireWorkspace } from "../context.js";
import { analyticsService } from "../../services/analyticsService.js";
import { healthService } from "../../services/healthService.js";
import { notificationService } from "../../services/notificationService.js";
import { searchService } from "../../services/searchService.js";
import { createGitHubClientForUser } from "../../services/github/index.js";
import { paginate } from "../../lib/pagination.js";
import { NotFoundError } from "../../lib/errors.js";
import { AuditLog } from "../../models/auditLog.js";
import { Commit } from "../../models/commit.js";
import { Contributor } from "../../models/contributor.js";
import { Dependency } from "../../models/dependency.js";
import { Deployment } from "../../models/deployment.js";
import { Issue } from "../../models/issue.js";
import { Notification, NotificationPreference } from "../../models/notification.js";
import { PullRequest } from "../../models/pullRequest.js";
import { Recommendation } from "../../models/recommendation.js";
import { Release } from "../../models/release.js";
import { Repository, Branch } from "../../models/repository.js";
import { SecurityAlert } from "../../models/securityAlert.js";
import { SyncJob } from "../../models/syncJob.js";
import { Workflow, WorkflowRun } from "../../models/workflow.js";
import { Workspace, WorkspaceMember } from "../../models/workspace.js";

const oid = (id: string) => new Types.ObjectId(id);

function parse(input: unknown, schema: ZodTypeAny) {
  if (!input) return {};
  const result = schema.safeParse(input);
  if (!result.success) return {};
  return result.data as Record<string, unknown>;
}

const RANGE_MAP: Record<string, Range> = { _7D: "7D", _14D: "14D", _30D: "30D", _90D: "90D" };

function rangeOf(value: string | undefined): Range {
  return RANGE_MAP[value ?? "_30D"] ?? "30D";
}

export const queryResolvers = {
  /* ── identity & workspaces ────────────────────────────── */

  me: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
    if (!ctx.userId) return null;
    return ctx.user;
  },

  workspaces: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
    const { userId } = requireAuth(ctx);
    const memberships = await WorkspaceMember.find({ userId }).sort({ joinedAt: 1 }).lean().exec();
    const ids = memberships.map((m) => m.workspaceId);
    const workspaces = await Workspace.find({ _id: { $in: ids } }).lean().exec();
    const byId = new Map(workspaces.map((w) => [String(w._id), w]));
    return ids.map((id) => byId.get(String(id))).filter(Boolean);
  },

  workspace: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
    const { userId } = requireAuth(ctx);
    const membership = await WorkspaceMember.findOne({ workspaceId: args.id, userId }).lean().exec();
    if (!membership) throw new NotFoundError("Workspace not found");
    const workspace = await Workspace.findById(args.id).lean().exec();
    if (!workspace) throw new NotFoundError("Workspace not found");
    return workspace;
  },

  members: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    return WorkspaceMember.find({ workspaceId }).sort({ joinedAt: 1 }).lean().exec();
  },

  githubAccount: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
    const { userId } = requireAuth(ctx);
    const { GitHubAccount } = await import("../../models/githubAccount.js");
    const account = await GitHubAccount.findOne({ userId }).select("-accessTokenEncrypted").lean().exec();
    return account;
  },

  /* ── repositories ─────────────────────────────────────── */

  repositories: async (_parent: unknown, args: { filters?: unknown; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const filters = parse(args.filters, (await import("@parallax/shared")).repositoryFiltersSchema) as {
      search?: string;
      language?: string;
      health?: string;
      activity?: string;
      status?: string;
      sort?: string;
    };

    const query: Record<string, unknown> = { workspaceId, enabled: true };
    if (filters.search) query.name = { $regex: filters.search, $options: "i" };
    if (filters.language) query.language = filters.language;
    if (filters.status && filters.status !== "ALL") query.syncStatus = filters.status;

    const sortField = { NAME: "name", HEALTH: "createdAt", ACTIVITY: "lastActivityAt", PRS: "createdAt", ISSUES: "createdAt" }[filters.sort ?? "NAME"] ?? "name";

    let result = await paginate(Repository, query, (args.pagination ?? {}) as never, sortField === "name" ? "name" : "lastActivityAt");

    // Health filter requires joining health snapshots — apply post-filter when requested
    if (filters.health && filters.health !== "ALL" || filters.activity && filters.activity !== "ALL") {
      const ids = result.edges.map((e) => String((e.node as { _id: unknown })._id));
      const healthRows = await HealthScoreSnapshot(ids);
      const filtered = result.edges.filter((edge) => {
        const id = String((edge.node as { _id: unknown })._id);
        const h = healthRows.get(id);
        const healthOk =
          !filters.health || filters.health === "ALL" ||
          (filters.health === "HEALTHY" && (h?.overall ?? 0) >= 70) ||
          (filters.health === "NEEDS_ATTENTION" && (h?.overall ?? 0) >= 50 && (h?.overall ?? 0) < 70) ||
          (filters.health === "AT_RISK" && (h?.overall ?? 0) < 50);
        const activityOk =
          !filters.activity || filters.activity === "ALL" ||
          (filters.activity === "ACTIVE" && recentActivity(edge.node as never)) ||
          (filters.activity === "IDLE" && !recentActivity(edge.node as never));
        return healthOk && activityOk;
      });
      result = { ...result, edges: filtered };
    }

    if (filters.sort === "HEALTH") {
      const ids = result.edges.map((e) => String((e.node as { _id: unknown })._id));
      const healthRows = await HealthScoreSnapshot(ids);
      result = {
        ...result,
        edges: [...result.edges].sort((a, b) => {
          const ha = healthRows.get(String((a.node as { _id: unknown })._id))?.overall ?? -1;
          const hb = healthRows.get(String((b.node as { _id: unknown })._id))?.overall ?? -1;
          return hb - ha;
        }),
      };
    }
    return result;
  },

  repository: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const repo = await Repository.findOne({ _id: oid(args.id), workspaceId }).lean().exec();
    if (!repo) throw new NotFoundError("Repository not found");
    return repo;
  },

  repositoryHealth: async (_parent: unknown, args: { id: string; range?: string }, ctx: GraphQLContext) => {
    requireWorkspace(ctx);
    requireAuth(ctx);
    const repo = await Repository.findById(args.id).select("workspaceId").lean().exec();
    if (!repo) throw new NotFoundError("Repository not found");
    const latest = await healthService.getLatest(args.id);
    if (!latest) return null;
    return {
      repositoryId: args.id,
      overall: latest.overall,
      change: latest.change,
      computedAt: latest.computedAt,
    };
  },

  branches: async (_parent: unknown, args: { repositoryId: string }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
    if (!repo) throw new NotFoundError("Repository not found");
    return Branch.find({ repositoryId: args.repositoryId }).lean().exec();
  },

  commits: async (_parent: unknown, args: { repositoryId: string; filters?: unknown; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
    if (!repo) throw new NotFoundError("Repository not found");
    const filters = parse(args.filters, (await import("@parallax/shared")).commitFiltersSchema);
    const query: Record<string, unknown> = { repositoryId: args.repositoryId };
    if (filters.author) query.authorLogin = filters.author;
    if (filters.classification) query.classification = filters.classification;
    if (filters.since || filters.until) {
      const range: Record<string, Date> = {};
      if (filters.since) range.$gte = new Date(filters.since as string);
      if (filters.until) range.$lte = new Date(filters.until as string);
      query.date = range;
    }
    return paginate(Commit, query, (args.pagination ?? {}) as never, "date");
  },

  commit: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
    requireWorkspace(ctx);
    requireAuth(ctx);
    return Commit.findById(args.id).lean().exec();
  },

  /* ── pull requests ────────────────────────────────────── */

  pullRequests: async (_parent: unknown, args: { repositoryId?: string; filters?: unknown; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const query: Record<string, unknown> = {};
    if (args.repositoryId) {
      const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
      if (!repo) throw new NotFoundError("Repository not found");
      query.repositoryId = args.repositoryId;
    } else {
      const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
      query.repositoryId = { $in: repos.map((r) => oid(String(r._id))) };
    }
    const filters = parse(args.filters, prFiltersSchema);
    if (filters.state && filters.state !== "ALL") query.state = filters.state;
    if (filters.author) query.authorLogin = filters.author;
    if (filters.risk && filters.risk !== "ALL") query.riskLevel = filters.risk;
    if (filters.label) query.labels = filters.label;
    return paginate(PullRequest, query, (args.pagination ?? {}) as never, "createdAt");
  },

  pullRequest: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const pr = await PullRequest.findById(args.id).lean().exec();
    if (!pr) throw new NotFoundError("Pull request not found");
    const repo = await Repository.findOne({ _id: pr.repositoryId, workspaceId }).select("_id").lean().exec();
    if (!repo) throw new NotFoundError("Pull request not found");
    return pr;
  },

  /* ── issues ───────────────────────────────────────────── */

  issues: async (_parent: unknown, args: { repositoryId?: string; filters?: unknown; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const query: Record<string, unknown> = {};
    if (args.repositoryId) {
      const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
      if (!repo) throw new NotFoundError("Repository not found");
      query.repositoryId = args.repositoryId;
    } else {
      const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
      query.repositoryId = { $in: repos.map((r) => oid(String(r._id))) };
    }
    const filters = parse(args.filters, (await import("@parallax/shared")).issueFiltersSchema);
    if (filters.state && filters.state !== "ALL") query.state = filters.state;
    if (filters.label) query.labels = filters.label;
    if (filters.critical) query.labels = { $in: [/critical/i, /security/i] };
    if (filters.stale) {
      query.state = "OPEN";
      query.updatedAt = { $lt: new Date(Date.now() - 30 * 86_400_000) };
    }
    return paginate(Issue, query, (args.pagination ?? {}) as never, "createdAt");
  },

  issue: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
    requireWorkspace(ctx);
    requireAuth(ctx);
    return Issue.findById(args.id).lean().exec();
  },

  /* ── dependencies & security ──────────────────────────── */

  dependencies: async (_parent: unknown, args: { repositoryId?: string; filters?: unknown; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const query: Record<string, unknown> = {};
    if (args.repositoryId) {
      const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
      if (!repo) throw new NotFoundError("Repository not found");
      query.repositoryId = args.repositoryId;
    } else {
      const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
      query.repositoryId = { $in: repos.map((r) => oid(String(r._id))) };
    }
    const filters = parse(args.filters, (await import("@parallax/shared")).dependencyFiltersSchema);
    if (filters.ecosystem) query.ecosystem = filters.ecosystem;
    if (filters.search) query.name = { $regex: filters.search, $options: "i" };
    switch (filters.update) {
      case "CRITICAL":
        query.risk = { $in: ["CRITICAL", "HIGH"] };
        break;
      case "MAJOR":
        query.updateType = "MAJOR";
        break;
      case "MINOR":
        query.updateType = "MINOR";
        break;
      case "PATCH":
        query.updateType = "PATCH";
        break;
      case "SECURITY":
        query["vulnerabilities.0"] = { $exists: true };
        break;
      default:
        break;
    }
    return paginate(Dependency, query, (args.pagination ?? {}) as never, "name");
  },

  securityAlerts: async (_parent: unknown, args: { repositoryId?: string; filters?: unknown; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const query: Record<string, unknown> = {};
    if (args.repositoryId) {
      const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
      if (!repo) throw new NotFoundError("Repository not found");
      query.repositoryId = args.repositoryId;
    } else {
      const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
      query.repositoryId = { $in: repos.map((r) => oid(String(r._id))) };
    }
    const filters = parse(args.filters, (await import("@parallax/shared")).securityFiltersSchema);
    if (filters.severity && filters.severity !== "ALL") query.severity = filters.severity;
    if (filters.state && filters.state !== "ALL") query.state = filters.state;
    if (filters.category) query.type = filters.category;
    return paginate(SecurityAlert, query, (args.pagination ?? {}) as never, "createdAt");
  },

  /* ── CI/CD ────────────────────────────────────────────── */

  workflows: async (_parent: unknown, args: { repositoryId: string }, ctx: GraphQLContext) => {
    requireWorkspace(ctx);
    requireAuth(ctx);
    return Workflow.find({ repositoryId: args.repositoryId }).lean().exec();
  },

  workflowRuns: async (_parent: unknown, args: { repositoryId?: string; filters?: unknown; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const query: Record<string, unknown> = {};
    if (args.repositoryId) {
      const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
      if (!repo) throw new NotFoundError("Repository not found");
      query.repositoryId = args.repositoryId;
    } else {
      const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
      query.repositoryId = { $in: repos.map((r) => oid(String(r._id))) };
    }
    const filters = parse(args.filters, (await import("@parallax/shared")).workflowFiltersSchema);
    if (filters.status && filters.status !== "ALL") {
      query.status = filters.status === "FAILURE" ? { $in: ["FAILURE", "CANCELLED", "ACTION_REQUIRED"] } : filters.status;
    }
    if (filters.branch) query.branch = filters.branch;
    return paginate(WorkflowRun, query, (args.pagination ?? {}) as never, "createdAt");
  },

  deployments: async (_parent: unknown, args: { repositoryId?: string; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const query: Record<string, unknown> = {};
    if (args.repositoryId) {
      const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
      if (!repo) throw new NotFoundError("Repository not found");
      query.repositoryId = args.repositoryId;
    } else {
      const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
      query.repositoryId = { $in: repos.map((r) => oid(String(r._id))) };
    }
    return paginate(Deployment, query, (args.pagination ?? {}) as never, "createdAt");
  },

  releases: async (_parent: unknown, args: { repositoryId?: string; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const query: Record<string, unknown> = {};
    if (args.repositoryId) {
      const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
      if (!repo) throw new NotFoundError("Repository not found");
      query.repositoryId = args.repositoryId;
    } else {
      const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
      query.repositoryId = { $in: repos.map((r) => oid(String(r._id))) };
    }
    return paginate(Release, query, (args.pagination ?? {}) as never, "publishedAt");
  },

  contributors: async (_parent: unknown, args: { repositoryId?: string; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const query: Record<string, unknown> = {};
    if (args.repositoryId) {
      const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
      if (!repo) throw new NotFoundError("Repository not found");
      query.repositoryId = args.repositoryId;
    } else {
      const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
      query.repositoryId = { $in: repos.map((r) => oid(String(r._id))) };
    }
    return paginate(Contributor, query, (args.pagination ?? {}) as never, "commits");
  },

  /* ── intelligence ─────────────────────────────────────── */

  recommendations: async (_parent: unknown, args: { status?: string; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const query: Record<string, unknown> = { workspaceId };
    if (args.status && args.status !== "ACTIVE") query.status = args.status;
    return paginate(Recommendation, query, (args.pagination ?? {}) as never, "createdAt");
  },

  notifications: async (_parent: unknown, args: { pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    const { userId } = requireAuth(ctx);
    const query = { workspaceId, $or: [{ userId }, { userId: { $exists: false } }] };
    return paginate(Notification, query, (args.pagination ?? {}) as never, "createdAt");
  },

  unreadNotificationCount: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    const { userId } = requireAuth(ctx);
    return notificationService.unreadCount(workspaceId, userId);
  },

  notificationPreferences: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    const { userId } = requireAuth(ctx);
    const prefs = await NotificationPreference.findOne({ userId, workspaceId }).lean().exec();
    return {
      enabled: prefs?.enabled ?? true,
      types: prefs?.types ?? [],
    };
  },

  auditLogs: async (_parent: unknown, args: { pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    return paginate(AuditLog, { workspaceId }, (args.pagination ?? {}) as never, "createdAt");
  },

  /* ── analytics ────────────────────────────────────────── */

  engineeringOverview: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const overview = await analyticsService.engineeringOverview(workspaceId);
    const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
    return {
      ...overview,
      workspaceId,
      repositoryIds: repos.map((r) => String(r._id)),
    };
  },

  engineeringActivity: async (_parent: unknown, args: { filters?: string[]; pagination?: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const pagination = (args.pagination ?? {}) as { first?: number; after?: string };
    const limit = Math.min(pagination.first ?? 30, 60);
    const afterDate = pagination.after ? new Date(Buffer.from(pagination.after, "base64url").toString("utf8")) : undefined;
    const { items, hasMore } = await analyticsService.engineeringActivity(workspaceId, {
      filters: (args.filters ?? ["ALL"]) as never,
      limit: limit + 1,
      after: afterDate?.toISOString(),
    });
    const page = items.slice(0, limit);
    return {
      edges: page.map((item) => {
        const node = item as {
          id: string;
          at: Date;
          type: string;
          repositoryId?: string;
          repositoryName?: string;
          title: string;
          subtitle?: string;
          meta?: Record<string, unknown>;
        };
        return {
          node: {
            id: node.id,
            at: node.at,
            type: node.type,
            repositoryId: node.repositoryId,
            repositoryName: node.repositoryName,
            title: node.title,
            subtitle: node.subtitle,
            meta: node.meta,
          },
          cursor: Buffer.from(node.at.toISOString(), "utf8").toString("base64url"),
        };
      }),
      pageInfo: {
        hasNextPage: hasMore,
        hasPreviousPage: Boolean(pagination.after),
        startCursor: null,
        endCursor: page.length ? Buffer.from((page[0] as { at: Date }).at.toISOString(), "utf8").toString("base64url") : null,
      },
      totalCount: page.length,
    };
  },

  commitAnalytics: (_p: unknown, args: { repositoryId?: string; range?: string }, ctx: GraphQLContext) =>
    analyticsResolver(ctx, args, (scope, range) => analyticsService.commitAnalytics(scope, range)),
  pullRequestAnalytics: (_p: unknown, args: { repositoryId?: string; range?: string }, ctx: GraphQLContext) =>
    analyticsResolver(ctx, args, (scope, range) => analyticsService.pullRequestAnalytics(scope, range)),
  issueAnalytics: (_p: unknown, args: { repositoryId?: string; range?: string }, ctx: GraphQLContext) =>
    analyticsResolver(ctx, args, (scope, range) => analyticsService.issueAnalytics(scope, range)),
  dependencyAnalytics: (_p: unknown, args: { repositoryId?: string }, ctx: GraphQLContext) =>
    analyticsResolver(ctx, args, (scope) => analyticsService.dependencyAnalytics(scope)),
  securityAnalytics: (_p: unknown, args: { repositoryId?: string }, ctx: GraphQLContext) =>
    analyticsResolver(ctx, args, (scope) => analyticsService.securityAnalytics(scope)),
  cicdAnalytics: (_p: unknown, args: { repositoryId?: string; range?: string }, ctx: GraphQLContext) =>
    analyticsResolver(ctx, args, (scope, range) => analyticsService.cicdAnalytics(scope, range)),
  deploymentAnalytics: (_p: unknown, args: { repositoryId?: string; range?: string }, ctx: GraphQLContext) =>
    analyticsResolver(ctx, args, (scope, range) => analyticsService.deploymentAnalytics(scope, range)),
  releaseAnalytics: (_p: unknown, args: { repositoryId?: string; range?: string }, ctx: GraphQLContext) =>
    analyticsResolver(ctx, args, (scope, range) => analyticsService.releaseAnalytics(scope, range)),
  contributorAnalytics: (_p: unknown, args: { repositoryId?: string; range?: string }, ctx: GraphQLContext) =>
    analyticsResolver(ctx, args, (scope, range) => analyticsService.contributorAnalytics(scope, range)),

  deliveryAnalytics: async (_p: unknown, args: { repositoryId?: string; range?: string }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const scope = { workspaceId, repositoryId: args.repositoryId };
    if (args.repositoryId) await assertRepoInWorkspace(args.repositoryId, workspaceId);
    const funnel = await analyticsService.deliveryAnalytics(scope, rangeOf(args.range));
    return {
      ...funnel,
      stages: funnel.stages.map((stage) => ({
        ...stage,
        isBottleneck: funnel.bottleneck?.to === stage.to && funnel.bottleneck?.from === stage.from,
      })),
      // The funnel's bottleneck object also needs the non-null isBottleneck flag.
      bottleneck: funnel.bottleneck ? { ...funnel.bottleneck, isBottleneck: true } : null,
    };
  },

  repositoryComparison: async (_p: unknown, args: { range?: string }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    return analyticsService.repositoryComparison({ workspaceId }, (args.range as never) ?? "_30D");
  },

  /* ── sync & search ────────────────────────────────────── */

  syncJob: async (_p: unknown, args: { repositoryId: string }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
    if (!repo) throw new NotFoundError("Repository not found");
    const job = await SyncJob.findOne({ repositoryId: args.repositoryId }).sort({ createdAt: -1 }).lean().exec();
    if (!job) return null;
    return {
      ...job,
      progress: job.progress || { phase: "queued", current: 0, total: 0, percent: 0 },
      stats: job.stats || {},
    };
  },

  availableRepositories: async (_p: unknown, _args: unknown, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    const { userId } = requireAuth(ctx);
    const client = await createGitHubClientForUser(userId);
    const available = await client.listRepositories();
    const connected = await Repository.find({ workspaceId, enabled: true }).select("githubId").lean().exec();
    const connectedIds = new Set(connected.map((r) => r.githubId));
    return available.map((repo) => ({
      githubId: repo.githubId,
      name: repo.name,
      fullName: repo.fullName,
      language: repo.language,
      description: repo.description,
      isPrivate: repo.isPrivate,
      connected: connectedIds.has(repo.githubId),
    }));
  },

  search: async (_p: unknown, args: { query: string; limit?: number }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    if (!args.query?.trim()) return { repositories: [], pullRequests: [], issues: [], commits: [], dependencies: [], deployments: [], contributors: [], recommendations: [] };
    return searchService.search(workspaceId, args.query, Math.min(args.limit ?? 6, 15));
  },
};

async function analyticsResolver<T>(
  ctx: GraphQLContext,
  args: { repositoryId?: string; range?: string },
  fn: (scope: { workspaceId: string; repositoryId?: string }, range: Range) => Promise<T>,
): Promise<T> {
  const workspaceId = requireWorkspace(ctx);
  requireAuth(ctx);
  if (args.repositoryId) await assertRepoInWorkspace(args.repositoryId, workspaceId);
  return fn({ workspaceId, repositoryId: args.repositoryId }, rangeOf(args.range));
}

async function assertRepoInWorkspace(repositoryId: string, workspaceId: string): Promise<void> {
  const repo = await Repository.findOne({ _id: oid(repositoryId), workspaceId }).select("_id").lean().exec();
  if (!repo) throw new NotFoundError("Repository not found");
}

async function HealthScoreSnapshot(ids: string[]) {
  const { HealthScore } = await import("../../models/health.js");
  const rows = await HealthScore.aggregate<{ _id: string; overall: number }>([
    { $match: { repositoryId: { $in: ids.map(oid) } } },
    { $sort: { computedAt: -1 } },
    { $group: { _id: "$repositoryId", overall: { $first: "$overall" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

function recentActivity(node: { lastActivityAt?: Date; pushedAt?: Date }): boolean {
  const at = node.lastActivityAt ?? node.pushedAt;
  return Boolean(at) && Date.now() - new Date(at!).getTime() < 14 * 86_400_000;
}

