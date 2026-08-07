import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { SyncJobStatus } from "@parallax/shared";

export interface SyncJobDoc {
  _id: Schema.Types.ObjectId;
  workspaceId: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  type: "FULL" | "INCREMENTAL";
  status: SyncJobStatus;
  progress: { phase: string; current: number; total: number; percent: number };
  stats: Record<string, number>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  triggeredBy: "WEBHOOK" | "MANUAL" | "SCHEDULE";
  createdAt: Date;
  updatedAt: Date;
}

const syncJobSchema = new Schema<SyncJobDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
    type: { type: String, enum: ["FULL", "INCREMENTAL"], default: "FULL" },
    status: { type: String, enum: ["QUEUED", "RUNNING", "COMPLETED", "FAILED"], default: "QUEUED" },
    progress: {
      phase: { type: String, default: "queued" },
      current: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      percent: { type: Number, default: 0 },
    },
    stats: { type: Schema.Types.Mixed, default: {} },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    triggeredBy: { type: String, enum: ["WEBHOOK", "MANUAL", "SCHEDULE"], default: "MANUAL" },
  },
  { timestamps: true },
);

syncJobSchema.index({ repositoryId: 1, createdAt: -1 });
syncJobSchema.index({ workspaceId: 1, status: 1 });

export const SyncJob = typedModel<SyncJobDoc>("SyncJob", syncJobSchema);
