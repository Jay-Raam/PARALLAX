import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";

export interface ContributorDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  login: string;
  name?: string;
  avatarUrl?: string;
  role: string;
  commits: number;
  additions: number;
  deletions: number;
  pullRequestsCreated: number;
  reviewsGiven: number;
  issuesOpened: number;
  issuesClosed: number;
  firstContributionAt: Date;
  lastContributionAt: Date;
}

const contributorSchema = new Schema<ContributorDoc>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    login: { type: String, required: true },
    name: { type: String },
    avatarUrl: { type: String },
    role: { type: String, default: "COLLABORATOR" },
    commits: { type: Number, default: 0 },
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    pullRequestsCreated: { type: Number, default: 0 },
    reviewsGiven: { type: Number, default: 0 },
    issuesOpened: { type: Number, default: 0 },
    issuesClosed: { type: Number, default: 0 },
    firstContributionAt: { type: Date },
    lastContributionAt: { type: Date },
  },
  { timestamps: true },
);

contributorSchema.index({ repositoryId: 1, login: 1 }, { unique: true });
contributorSchema.index({ repositoryId: 1, commits: -1 });

export const Contributor = typedModel<ContributorDoc>("Contributor", contributorSchema);
