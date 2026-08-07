import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { Role } from "@parallax/shared";

export interface WorkspaceSettingsDoc {
  defaultBranch?: string;
  timezone?: string;
  syncIntervalMinutes?: number;
  healthThreshold?: number;
}

export interface WorkspaceDoc {
  _id: Schema.Types.ObjectId;
  name: string;
  slug: string;
  ownerId: Schema.Types.ObjectId;
  githubOrg?: string;
  settings: WorkspaceSettingsDoc;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<WorkspaceDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    githubOrg: { type: String },
    settings: {
      defaultBranch: { type: String, default: "main" },
      timezone: { type: String, default: "UTC" },
      syncIntervalMinutes: { type: Number, default: 60 },
      healthThreshold: { type: Number, default: 70 },
    },
  },
  { timestamps: true },
);

export interface WorkspaceMemberDoc {
  _id: Schema.Types.ObjectId;
  workspaceId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  role: Role;
  joinedAt: Date;
}

const workspaceMemberSchema = new Schema<WorkspaceMemberDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
      default: "MEMBER",
      required: true,
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
workspaceMemberSchema.index({ userId: 1 });

export const Workspace = typedModel<WorkspaceDoc>("Workspace", workspaceSchema);
export const WorkspaceMember = typedModel<WorkspaceMemberDoc>("WorkspaceMember", workspaceMemberSchema);
