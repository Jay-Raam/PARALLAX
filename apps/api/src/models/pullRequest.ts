import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { PRState, RiskLevel } from "@parallax/shared";

export interface PullRequestDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  githubNumber: number;
  title: string;
  body?: string;
  state: PRState;
  authorLogin: string;
  createdAt: Date;
  updatedAt?: Date;
  closedAt?: Date;
  mergedAt?: Date;
  mergedBy?: string;
  baseRef: string;
  headRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  isDraft: boolean;
  labels: string[];
  reviewDecision?: string;
  riskScore?: number;
  riskLevel?: RiskLevel;
  riskFactors: string[];
  riskExplanation?: string;
  reviewTimeMs?: number;
  approvalTimeMs?: number;
  mergeTimeMs?: number;
  deployTimeMs?: number;
  testFilesChanged: number;
  dependenciesChanged: number;
  authFilesChanged: number;
  migrationFilesChanged: number;
  files: string[];
  lifecycle: { stage: string; at?: Date }[];
}

const prSchema = new Schema<PullRequestDoc>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    githubNumber: { type: Number, required: true },
    title: { type: String, required: true },
    body: { type: String },
    state: { type: String, enum: ["OPEN", "CLOSED", "MERGED"], default: "OPEN" },
    authorLogin: { type: String, required: true, index: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date },
    closedAt: { type: Date },
    mergedAt: { type: Date },
    mergedBy: { type: String },
    baseRef: { type: String, default: "main" },
    headRef: { type: String, default: "" },
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    changedFiles: { type: Number, default: 0 },
    commits: { type: Number, default: 0 },
    isDraft: { type: Boolean, default: false },
    labels: { type: [String], default: [] },
    reviewDecision: { type: String },
    riskScore: { type: Number },
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    riskFactors: { type: [String], default: [] },
    riskExplanation: { type: String },
    reviewTimeMs: { type: Number },
    approvalTimeMs: { type: Number },
    mergeTimeMs: { type: Number },
    deployTimeMs: { type: Number },
    testFilesChanged: { type: Number, default: 0 },
    dependenciesChanged: { type: Number, default: 0 },
    authFilesChanged: { type: Number, default: 0 },
    migrationFilesChanged: { type: Number, default: 0 },
    files: { type: [String], default: [] },
    lifecycle: { type: [{ stage: String, at: Date }], default: [] },
  },
  { timestamps: false },
);

prSchema.index({ repositoryId: 1, githubNumber: 1 }, { unique: true });
prSchema.index({ repositoryId: 1, state: 1, updatedAt: -1 });
prSchema.index({ repositoryId: 1, createdAt: -1 });
prSchema.index({ repositoryId: 1, riskLevel: 1 });
prSchema.index({ authorLogin: 1, createdAt: -1 });

export interface PullRequestReviewDoc {
  _id: Schema.Types.ObjectId;
  pullRequestId: Schema.Types.ObjectId;
  githubId?: number;
  reviewerLogin: string;
  state: string;
  submittedAt?: Date;
  body?: string;
}

const reviewSchema = new Schema<PullRequestReviewDoc>({
  pullRequestId: { type: Schema.Types.ObjectId, ref: "PullRequest", required: true },
  githubId: { type: Number },
  reviewerLogin: { type: String, required: true },
  state: { type: String, required: true },
  submittedAt: { type: Date },
  body: { type: String },
});

reviewSchema.index({ pullRequestId: 1, submittedAt: 1 });

export const PullRequest = typedModel<PullRequestDoc>("PullRequest", prSchema);
export const PullRequestReview = typedModel<PullRequestReviewDoc>("PullRequestReview", reviewSchema);
