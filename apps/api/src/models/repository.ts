import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { SyncStatus } from "@parallax/shared";

export interface RepositoryDoc {
  _id: Schema.Types.ObjectId;
  workspaceId: Schema.Types.ObjectId;
  githubId: number;
  name: string;
  fullName: string;
  owner: string;
  description?: string;
  url: string;
  defaultBranch: string;
  isPrivate: boolean;
  language?: string;
  techStack: string[];
  topics: string[];
  fork: boolean;
  archived: boolean;
  createdAt: Date;
  pushedAt?: Date;
  starCount: number;
  forkCount: number;
  openIssuesCount: number;
  syncStatus: SyncStatus;
  lastSyncedAt?: Date;
  lastCommitSha?: string;
  enabled: boolean;
  source: "github" | "mock";
  lastActivityAt?: Date;
}

const repositorySchema = new Schema<RepositoryDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    githubId: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    fullName: { type: String, required: true },
    owner: { type: String, required: true },
    description: { type: String },
    url: { type: String, required: true },
    defaultBranch: { type: String, default: "main" },
    isPrivate: { type: Boolean, default: false },
    language: { type: String },
    techStack: { type: [String], default: [] },
    topics: { type: [String], default: [] },
    fork: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    createdAt: { type: Date, required: true },
    pushedAt: { type: Date },
    starCount: { type: Number, default: 0 },
    forkCount: { type: Number, default: 0 },
    openIssuesCount: { type: Number, default: 0 },
    syncStatus: {
      type: String,
      enum: ["NOT_SYNCED", "SYNCING", "SYNCED", "ERROR"],
      default: "NOT_SYNCED",
    },
    lastSyncedAt: { type: Date },
    lastCommitSha: { type: String },
    enabled: { type: Boolean, default: true },
    source: { type: String, enum: ["github", "mock"], default: "github" },
    lastActivityAt: { type: Date },
  },
  { timestamps: true },
);

repositorySchema.index({ workspaceId: 1, githubId: 1 }, { unique: true });
repositorySchema.index({ workspaceId: 1, enabled: 1 });
repositorySchema.index({ workspaceId: 1, name: 1 });
repositorySchema.index({ workspaceId: 1, language: 1 });
repositorySchema.index({ workspaceId: 1, syncStatus: 1 });
repositorySchema.index({ workspaceId: 1, lastActivityAt: -1 });

export interface BranchDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  name: string;
  headSha: string;
  isDefault: boolean;
  lastCommitAt?: Date;
}

const branchSchema = new Schema<BranchDoc>({
  repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
  name: { type: String, required: true },
  headSha: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  lastCommitAt: { type: Date },
});

branchSchema.index({ repositoryId: 1, name: 1 }, { unique: true });

export const Repository = typedModel<RepositoryDoc>("Repository", repositorySchema);
export const Branch = typedModel<BranchDoc>("Branch", branchSchema);
