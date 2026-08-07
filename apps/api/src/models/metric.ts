import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";

export interface RepositoryMetricDoc {
  _id: Schema.Types.ObjectId;
  workspaceId: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  date: Date;
  commits: number;
  pullRequestsOpened: number;
  pullRequestsMerged: number;
  issuesOpened: number;
  issuesClosed: number;
  deployments: number;
  deploymentsFailed: number;
  releases: number;
  additions: number;
  deletions: number;
  contributors: number;
  buildRuns: number;
  buildFailures: number;
  avgBuildTimeMs: number;
  cycleTimeMs: number;
  reviewTimeMs: number;
  issueResolutionMs: number;
}

const metricSchema = new Schema<RepositoryMetricDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    date: { type: Date, required: true },
    commits: { type: Number, default: 0 },
    pullRequestsOpened: { type: Number, default: 0 },
    pullRequestsMerged: { type: Number, default: 0 },
    issuesOpened: { type: Number, default: 0 },
    issuesClosed: { type: Number, default: 0 },
    deployments: { type: Number, default: 0 },
    deploymentsFailed: { type: Number, default: 0 },
    releases: { type: Number, default: 0 },
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    contributors: { type: Number, default: 0 },
    buildRuns: { type: Number, default: 0 },
    buildFailures: { type: Number, default: 0 },
    avgBuildTimeMs: { type: Number, default: 0 },
    cycleTimeMs: { type: Number, default: 0 },
    reviewTimeMs: { type: Number, default: 0 },
    issueResolutionMs: { type: Number, default: 0 },
  },
  { timestamps: false },
);

metricSchema.index({ repositoryId: 1, date: 1 }, { unique: true });
metricSchema.index({ workspaceId: 1, date: -1 });

export const RepositoryMetric = typedModel<RepositoryMetricDoc>("RepositoryMetric", metricSchema);
