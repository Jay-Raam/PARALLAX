import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { WorkflowRunStatus } from "@parallax/shared";

export interface WorkflowDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  githubId?: number;
  name: string;
  path: string;
  state: string;
}

const workflowSchema = new Schema<WorkflowDoc>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    githubId: { type: Number },
    name: { type: String, required: true },
    path: { type: String, required: true },
    state: { type: String, default: "ACTIVE" },
  },
  { timestamps: true },
);

workflowSchema.index({ repositoryId: 1, name: 1 }, { unique: true });

export interface WorkflowStepDoc {
  _id: Schema.Types.ObjectId;
  name: string;
  status: string;
  conclusion?: string;
  durationMs?: number;
}

export interface WorkflowRunDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  workflowId: Schema.Types.ObjectId;
  workflowName: string;
  githubId?: number;
  runNumber: number;
  event: string;
  status: WorkflowRunStatus;
  conclusion?: string;
  headSha: string;
  branch: string;
  createdAt: Date;
  updatedAt?: Date;
  durationMs?: number;
  steps: WorkflowStepDoc[];
}

const runSchema = new Schema<WorkflowRunDoc>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    workflowId: { type: Schema.Types.ObjectId, ref: "Workflow", required: true },
    workflowName: { type: String, required: true },
    githubId: { type: Number },
    runNumber: { type: Number, required: true },
    event: { type: String, default: "push" },
    status: {
      type: String,
      enum: [
        "QUEUED",
        "IN_PROGRESS",
        "COMPLETED",
        "ACTION_REQUIRED",
        "CANCELLED",
        "FAILURE",
        "NEUTRAL",
        "SKIPPED",
        "STALE",
        "SUCCESS",
      ],
      required: true,
    },
    conclusion: { type: String },
    headSha: { type: String },
    branch: { type: String },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date },
    durationMs: { type: Number },
    steps: { type: [{ name: String, status: String, conclusion: String, durationMs: Number }], default: [] },
  },
  { timestamps: false },
);

runSchema.index({ repositoryId: 1, createdAt: -1 });
runSchema.index({ repositoryId: 1, status: 1 });
runSchema.index({ workflowId: 1, runNumber: 1 }, { unique: true, sparse: true });

export const Workflow = typedModel<WorkflowDoc>("Workflow", workflowSchema);
export const WorkflowRun = typedModel<WorkflowRunDoc>("WorkflowRun", runSchema);
