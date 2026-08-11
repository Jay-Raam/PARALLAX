import { Types } from "mongoose";
import {
  notificationPreferenceSchema,
  updateProfileSchema,
  updateWorkspaceSchema,
  ROLES,
  type Role,
} from "@parallax/shared";
import type { GraphQLContext } from "../context.js";
import { requireAdmin, requireAuth, requireWorkspace } from "../context.js";
import { auditService } from "../../services/auditService.js";
import { createGitHubClientForUser } from "../../services/github/index.js";
import { syncService } from "../../services/syncService.js";
import { enqueue, QUEUES } from "../../lib/queue.js";
import { writeSession, clearSession } from "../../lib/session.js";
import { ValidationError, NotFoundError, ConflictError, AuthorizationError, AppError } from "../../lib/errors.js";
import { User } from "../../models/user.js";
import { Workspace, WorkspaceMember } from "../../models/workspace.js";
import { Repository } from "../../models/repository.js";
import { Recommendation } from "../../models/recommendation.js";
import { Notification, NotificationPreference } from "../../models/notification.js";
import { GitHubAccount } from "../../models/githubAccount.js";
import { encryptSecret } from "../../lib/encryption.js";

const oid = (id: string) => new Types.ObjectId(id);

async function enqueueSync(repositoryId: string, mode: "FULL" | "INCREMENTAL", triggeredBy: "WEBHOOK" | "MANUAL" | "SCHEDULE") {
  const job = await syncService.createSyncJob(repositoryId, { mode, triggeredBy });
  await enqueue(QUEUES.GITHUB_SYNC, "sync-repository", { jobId: String(job._id), repositoryId }, {
    jobId: `sync-${repositoryId}-${mode}-${triggeredBy}-${Date.now()}`,
  });
  return job;
}

export const mutationResolvers = {
  /* ── auth ─────────────────────────────────────────────── */

  login: async (_p: unknown, args: { email: string }, ctx: GraphQLContext) => {
    if (!args.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.email)) {
      throw new ValidationError("A valid email is required to sign in");
    }
    const email = args.email.toLowerCase();
    let user = await User.findOne({ email }).lean().exec();
    if (!user) {
      const name = email.split("@")[0]!.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const created = await User.create({ email, name });
      user = await User.findById(created._id).lean().exec();
    }

    const membership = await WorkspaceMember.findOne({ userId: user!._id }).sort({ joinedAt: 1 }).lean().exec();
    let workspace = membership ? await Workspace.findById(membership.workspaceId).lean().exec() : null;
    if (!workspace) {
      const slug = `workspace-${user!._id.toString().slice(-6)}`;
      const created = await Workspace.create({ name: "Demo Workspace", slug, ownerId: user!._id, settings: {} });
      await WorkspaceMember.create({ workspaceId: created._id, userId: user!._id, role: "OWNER" });
      workspace = await Workspace.findById(created._id).lean().exec();
    }

    writeSession(ctx.res, { userId: String(user!._id), workspaceId: String(workspace!._id), issuedAt: Date.now() });
    void auditService.log({
      workspaceId: String(workspace!._id),
      actorId: String(user!._id),
      actorName: user!.name,
      action: "LOGIN",
      ip: ctx.req.ip,
    });

    const refreshed = await User.findById(user!._id).lean().exec();
    return { user: refreshed ?? user!, workspace: workspace! };
  },

  logout: async (_p: unknown, _args: unknown, ctx: GraphQLContext) => {
    const auth = requireAuth(ctx);
    if (ctx.workspaceId) {
      void auditService.log({ workspaceId: ctx.workspaceId, actorId: auth.userId, actorName: auth.user.name, action: "LOGOUT", ip: ctx.req.ip });
    }
    clearSession(ctx.res);
    return true;
  },

  /* ── workspaces ───────────────────────────────────────── */

  createWorkspace: async (_p: unknown, args: { name: string }, ctx: GraphQLContext) => {
    const { userId, user } = requireAuth(ctx);
    if (!args.name?.trim()) throw new ValidationError("Workspace name is required");
    const baseSlug = args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "workspace";
    let slug = baseSlug;
    let attempt = 1;
    while (await Workspace.findOne({ slug })) {
      slug = `${baseSlug}-${attempt++}`;
    }
    const workspace = await Workspace.create({ name: args.name.trim(), slug, ownerId: oid(userId), settings: {} });
    await WorkspaceMember.create({ workspaceId: workspace._id, userId: oid(userId), role: "OWNER" });
    writeSession(ctx.res, { userId, workspaceId: String(workspace._id), issuedAt: Date.now() });
    void auditService.log({ workspaceId: String(workspace._id), actorId: userId, actorName: user.name, action: "WORKSPACE_CREATED" });
    return workspace;
  },

  switchWorkspace: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
    const { userId } = requireAuth(ctx);
    const membership = await WorkspaceMember.findOne({ workspaceId: args.id, userId }).lean().exec();
    if (!membership) throw new NotFoundError("Workspace not found");
    writeSession(ctx.res, { userId, workspaceId: args.id, issuedAt: Date.now() });
    const workspace = await Workspace.findById(args.id).lean().exec();
    return workspace!;
  },

  updateWorkspace: async (_p: unknown, args: { id: string; input: unknown }, ctx: GraphQLContext) => {
    requireAdmin(ctx);
    const { userId, user } = requireAuth(ctx);
    if (args.id !== ctx.workspaceId) {
      // validate membership on the target workspace
      const membership = await WorkspaceMember.findOne({ workspaceId: args.id, userId }).lean().exec();
      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        throw new AuthorizationError("This action requires workspace admin access");
      }
    }
    const parsed = updateWorkspaceSchema.safeParse(args.input);
    if (!parsed.success) {
      throw new ValidationError("Invalid workspace settings", { issues: parsed.error.flatten().fieldErrors });
    }
    const workspace = await Workspace.findByIdAndUpdate(args.id, { $set: parsed.data }, { new: true }).lean().exec();
    if (!workspace) throw new NotFoundError("Workspace not found");
    void auditService.log({
      workspaceId: args.id,
      actorId: userId,
      actorName: user.name,
      action: "WORKSPACE_UPDATED",
      targetType: "Workspace",
      targetId: args.id,
    });
    return workspace;
  },

  addMember: async (_p: unknown, args: { input: { email: string; role: Role } }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAdmin(ctx);
    const { userId, user } = requireAuth(ctx);
    if (!args.input?.email || !ROLES.includes(args.input.role)) {
      throw new ValidationError("A valid email and role are required");
    }
    const target = await User.findOne({ email: args.input.email.toLowerCase() }).lean().exec();
    if (!target) throw new NotFoundError("No user with that email exists");
    const existing = await WorkspaceMember.findOne({ workspaceId, userId: target._id }).lean().exec();
    if (existing) throw new ConflictError("User is already a member of this workspace");
    const member = await WorkspaceMember.create({ workspaceId: oid(workspaceId), userId: target._id, role: args.input.role });
    void auditService.log({
      workspaceId,
      actorId: userId,
      actorName: user.name,
      action: "MEMBER_ADDED",
      targetType: "User",
      targetId: String(target._id),
      metadata: { email: target.email, role: args.input.role },
    });
    return member;
  },

  updateMemberRole: async (_p: unknown, args: { input: { userId: string; role: Role } }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAdmin(ctx);
    const { userId, user } = requireAuth(ctx);
    if (!ROLES.includes(args.input.role)) throw new ValidationError("Invalid role");
    if (args.input.userId === userId) throw new ConflictError("You cannot change your own role");
    const member = await WorkspaceMember.findOneAndUpdate(
      { workspaceId: oid(workspaceId), userId: oid(args.input.userId) },
      { $set: { role: args.input.role } },
      { new: true },
    )
      .lean()
      .exec();
    if (!member) throw new NotFoundError("Member not found");
    void auditService.log({
      workspaceId,
      actorId: userId,
      actorName: user.name,
      action: "ROLE_CHANGED",
      targetType: "User",
      targetId: args.input.userId,
      metadata: { role: args.input.role },
    });
    return member;
  },

  removeMember: async (_p: unknown, args: { userId: string }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAdmin(ctx);
    const { userId, user } = requireAuth(ctx);
    if (args.userId === userId) throw new ConflictError("You cannot remove yourself");
    const removed = await WorkspaceMember.findOneAndDelete({ workspaceId: oid(workspaceId), userId: oid(args.userId) }).lean().exec();
    if (!removed) throw new NotFoundError("Member not found");
    void auditService.log({
      workspaceId,
      actorId: userId,
      actorName: user.name,
      action: "MEMBER_REMOVED",
      targetType: "User",
      targetId: args.userId,
    });
    return true;
  },

  /* ── GitHub ───────────────────────────────────────────── */

  connectGitHub: async (_p: unknown, args: { code: string }, ctx: GraphQLContext) => {
    const { userId, user } = requireAuth(ctx);

    let githubLogin = user.email.split("@")[0]!;
    let tokenEncrypted: string | undefined;

    const { env } = await import("../../config/env.js");
    if (env.GITHUB_CLIENT_ID && args.code) {
      // Exchange the OAuth code for a token server-side
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: args.code,
        }),
      });
      const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        throw new AppError("GitHub authorization failed", "GITHUB_OAUTH_ERROR", 401, { error: tokenData.error });
      }
      const profile = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }).then((r) => r.json() as Promise<{ login: string }>);
      githubLogin = profile.login;
      tokenEncrypted = encryptSecret(tokenData.access_token);
    }

    const existing = await GitHubAccount.findOne({ userId: oid(userId) }).lean().exec();
    if (existing) {
      await GitHubAccount.updateOne({ _id: existing._id }, { $set: { githubLogin, accessTokenEncrypted: tokenEncrypted ?? existing.accessTokenEncrypted, connectedAt: new Date() } }).exec();
    } else {
      await GitHubAccount.create({
        userId: oid(userId),
        githubLogin,
        githubId: hashGithubId(githubLogin),
        accessTokenEncrypted: tokenEncrypted ?? encryptSecret("mock-token"),
      });
    }

    const workspaceId = requireWorkspace(ctx);
    void auditService.log({
      workspaceId,
      actorId: userId,
      actorName: user.name,
      action: "GITHUB_CONNECTED",
      metadata: { login: githubLogin },
    });

    const repos = await Repository.find({ workspaceId, enabled: true }).sort({ createdAt: -1 }).lean().exec();

    return {
      githubAccount: { githubLogin, connectedAt: new Date().toISOString() },
      repositories: {
        edges: repos.map((r) => ({ node: r, cursor: String(r._id) })),
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        totalCount: repos.length,
      },
    };
  },

  disconnectGitHub: async (_p: unknown, _args: unknown, ctx: GraphQLContext) => {
    const { userId, user } = requireAuth(ctx);
    const workspaceId = requireWorkspace(ctx);
    await GitHubAccount.deleteMany({ userId: oid(userId) });
    void auditService.log({ workspaceId, actorId: userId, actorName: user.name, action: "GITHUB_DISCONNECTED" });
    return true;
  },

  /* ── repositories ─────────────────────────────────────── */

  connectRepository: async (_p: unknown, args: { githubId: number }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    const { userId, user } = requireAuth(ctx);

    const client = await createGitHubClientForUser(userId);
    const available = await client.listRepositories();
    const meta = available.find((r) => r.githubId === args.githubId);
    if (!meta) throw new NotFoundError("Repository not found on the connected GitHub account");

    const existing = await Repository.findOne({ workspaceId, githubId: meta.githubId }).lean().exec();
    if (existing) {
      if (!existing.enabled) {
        await Repository.updateOne({ _id: existing._id }, { $set: { enabled: true } }).exec();
      }
      return (await Repository.findById(existing._id).lean().exec())!;
    }

    const repo = await Repository.create({
      workspaceId: oid(workspaceId),
      githubId: meta.githubId,
      name: meta.name,
      fullName: meta.fullName,
      owner: meta.owner,
      description: meta.description,
      url: meta.url,
      defaultBranch: meta.defaultBranch,
      isPrivate: meta.isPrivate,
      language: meta.language,
      techStack: meta.techStack,
      topics: meta.topics,
      fork: meta.fork,
      archived: meta.archived,
      createdAt: new Date(meta.createdAt),
      pushedAt: meta.pushedAt ? new Date(meta.pushedAt) : undefined,
      starCount: meta.starCount,
      forkCount: meta.forkCount,
      openIssuesCount: meta.openIssuesCount,
      syncStatus: "NOT_SYNCED",
      enabled: true,
      source: client.mode,
      lastActivityAt: meta.pushedAt ? new Date(meta.pushedAt) : undefined,
    });

    void auditService.log({
      workspaceId,
      actorId: userId,
      actorName: user.name,
      action: "REPOSITORY_CONNECTED",
      targetType: "Repository",
      targetId: String(repo._id),
      metadata: { name: meta.fullName },
    });

    void enqueueSync(String(repo._id), "FULL", "MANUAL");
    return (await Repository.findById(repo._id).lean().exec())!;
  },

  disconnectRepository: async (_p: unknown, args: { repositoryId: string }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    const { userId, user } = requireAuth(ctx);
    const repo = await Repository.findOneAndUpdate(
      { _id: oid(args.repositoryId), workspaceId },
      { $set: { enabled: false } },
      { new: true },
    )
      .lean()
      .exec();
    if (!repo) throw new NotFoundError("Repository not found");
    void auditService.log({
      workspaceId,
      actorId: userId,
      actorName: user.name,
      action: "REPOSITORY_DISCONNECTED",
      targetType: "Repository",
      targetId: args.repositoryId,
    });
    return true;
  },

  syncRepository: async (_p: unknown, args: { repositoryId: string; incremental?: boolean }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const repo = await Repository.findOne({ _id: oid(args.repositoryId), workspaceId }).select("_id").lean().exec();
    if (!repo) throw new NotFoundError("Repository not found");
    const job = await enqueueSync(args.repositoryId, args.incremental ? "INCREMENTAL" : "FULL", "MANUAL");
    return { syncJob: job };
  },

  syncWorkspace: async (_p: unknown, _args: unknown, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
    const jobs = [];
    for (const repo of repos) {
      const job = await enqueueSync(String(repo._id), "INCREMENTAL", "MANUAL");
      jobs.push({ syncJob: job });
    }
    return jobs;
  },

  /* ── profile & settings ───────────────────────────────── */

  updateProfile: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) => {
    const { userId } = requireAuth(ctx);
    const parsed = updateProfileSchema.safeParse(args.input);
    if (!parsed.success) throw new ValidationError("Invalid profile data", { issues: parsed.error.flatten().fieldErrors });
    const user = await User.findByIdAndUpdate(userId, { $set: parsed.data }, { new: true }).lean().exec();
    if (!user) throw new NotFoundError("User not found");
    return user;
  },

  updateNotificationPreferences: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    const { userId } = requireAuth(ctx);
    const parsed = notificationPreferenceSchema.safeParse(args.input);
    if (!parsed.success) throw new ValidationError("Invalid preferences", { issues: parsed.error.flatten().fieldErrors });
    const prefs = await NotificationPreference.findOneAndUpdate(
      { userId: oid(userId), workspaceId: oid(workspaceId) },
      { $set: { ...parsed.data, workspaceId: oid(workspaceId), userId: oid(userId) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
      .lean()
      .exec();
    return { enabled: prefs.enabled, types: prefs.types };
  },

  /* ── recommendations & notifications ──────────────────── */

  markRecommendationComplete: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const rec = await Recommendation.findOneAndUpdate(
      { _id: oid(args.id), workspaceId },
      { $set: { status: "COMPLETED" } },
      { new: true },
    )
      .lean()
      .exec();
    if (!rec) throw new NotFoundError("Recommendation not found");
    return rec;
  },

  dismissRecommendation: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const rec = await Recommendation.findOneAndUpdate(
      { _id: oid(args.id), workspaceId },
      { $set: { status: "DISMISSED" } },
      { new: true },
    )
      .lean()
      .exec();
    if (!rec) throw new NotFoundError("Recommendation not found");
    return rec;
  },

  markNotificationRead: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    requireAuth(ctx);
    const notification = await Notification.findOneAndUpdate(
      { _id: oid(args.id), workspaceId },
      { $set: { readAt: new Date() } },
      { new: true },
    )
      .lean()
      .exec();
    if (!notification) throw new NotFoundError("Notification not found");
    return notification;
  },

  markAllNotificationsRead: async (_p: unknown, _args: unknown, ctx: GraphQLContext) => {
    const workspaceId = requireWorkspace(ctx);
    const { userId } = requireAuth(ctx);
    await Notification.updateMany(
      { workspaceId, $or: [{ userId: oid(userId) }, { userId: { $exists: false } }], readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    ).exec();
    return true;
  },
};

function hashGithubId(login: string): number {
  let h = 0;
  for (let i = 0; i < login.length; i++) {
    h = (Math.imul(h, 31) + login.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 1_000_000_000;
}
