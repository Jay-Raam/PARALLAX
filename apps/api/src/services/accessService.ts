import type { Role } from "@parallax/shared";
import { WorkspaceMember } from "../models/workspace.js";
import { AuthorizationError, NotFoundError } from "../lib/errors.js";

export const ROLE_RANK: Record<Role, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

export async function getMembership(workspaceId: string, userId: string) {
  return WorkspaceMember.findOne({ workspaceId, userId }).lean().exec();
}

export async function requireMembership(workspaceId: string, userId: string) {
  const membership = await getMembership(workspaceId, userId);
  if (!membership) {
    throw new AuthorizationError("You do not have access to this workspace");
  }
  return membership;
}

export async function requireRole(workspaceId: string, userId: string, roles: Role[]) {
  const membership = await requireMembership(workspaceId, userId);
  const allowed = roles.some((role) => ROLE_RANK[membership.role] >= ROLE_RANK[role]);
  if (!allowed) {
    throw new AuthorizationError(`This action requires the ${roles.join(" or ")} role`);
  }
  return membership;
}

export async function findWorkspaceForUser(workspaceId: string, userId: string) {
  await requireMembership(workspaceId, userId);
  return workspaceId;
}

export async function assertWorkspaceExists(workspaceId: string): Promise<void> {
  const { Workspace } = await import("../models/workspace.js");
  const workspace = await Workspace.findById(workspaceId).lean().exec();
  if (!workspace) throw new NotFoundError("Workspace not found");
}
