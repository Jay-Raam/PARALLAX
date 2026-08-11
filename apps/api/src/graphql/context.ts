import type { Request, Response } from "express";
import type { PubSub } from "graphql-yoga";
import type { PubSubEvents } from "./pubsub.js";
import type { UserDoc } from "../models/user.js";
import type { WorkspaceMemberDoc } from "../models/workspace.js";
import { User } from "../models/user.js";
import { WorkspaceMember } from "../models/workspace.js";
import { readSession } from "../lib/session.js";
import { createLoaders, type Loaders } from "./loaders.js";
import { AuthenticationError, AuthorizationError } from "../lib/errors.js";

export interface GraphQLContext {
  req: Request;
  res: Response;
  user: UserDoc | null;
  userId: string | null;
  workspaceId: string | null;
  membership: WorkspaceMemberDoc | null;
  loaders: Loaders;
  pubsub: PubSub<PubSubEvents>;
}

export async function buildContext(req: Request, res: Response, pubsub: PubSub<PubSubEvents>): Promise<GraphQLContext> {
  const session = readSession(req);
  let user: UserDoc | null = null;
  let workspaceId: string | null = session?.workspaceId ?? null;
  let membership: WorkspaceMemberDoc | null = null;

  if (session?.userId) {
    user = await User.findById(session.userId).lean().exec();
    if (user) {
      // Refresh lastSeenAt occasionally (once per day)
      if (!user.lastSeenAt || Date.now() - new Date(user.lastSeenAt).getTime() > 86_400_000) {
        void User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } }).exec();
      }
      if (workspaceId) {
        membership = await WorkspaceMember.findOne({ workspaceId, userId: session.userId }).lean().exec();
        if (!membership) {
          // fall back to the user's most recent workspace
          const first = await WorkspaceMember.findOne({ userId: session.userId }).sort({ joinedAt: -1 }).lean().exec();
          workspaceId = first ? String(first.workspaceId) : null;
          membership = first;
        }
      }
    } else {
      workspaceId = null;
    }
  }

  return {
    req,
    res,
    user,
    userId: user ? String(user._id) : null,
    workspaceId,
    membership,
    loaders: createLoaders(),
    pubsub,
  };
}

export function requireAuth(ctx: GraphQLContext) {
  if (!ctx.userId || !ctx.user) {
    throw new AuthenticationError();
  }
  return { userId: ctx.userId, user: ctx.user };
}

export function requireWorkspace(ctx: GraphQLContext): string {
  if (!ctx.workspaceId) {
    throw new AuthenticationError("No active workspace. Create or join a workspace first.");
  }
  return ctx.workspaceId;
}

export function requireAdmin(ctx: GraphQLContext): void {
  requireWorkspace(ctx);
  if (!ctx.membership || (ctx.membership.role !== "OWNER" && ctx.membership.role !== "ADMIN")) {
    throw new AuthorizationError("This action requires workspace admin access");
  }
}
