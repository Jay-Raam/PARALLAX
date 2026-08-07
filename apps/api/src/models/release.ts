import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";

export interface ReleaseDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  githubId?: number;
  tagName: string;
  name?: string;
  publishedAt: Date;
  authorLogin: string;
  isPrerelease: boolean;
  body?: string;
  commitSha?: string;
  commitCount: number;
  features: string[];
  bugFixes: string[];
  breakingChanges: string[];
  dependencyChanges: string[];
}

const releaseSchema = new Schema<ReleaseDoc>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    githubId: { type: Number },
    tagName: { type: String, required: true },
    name: { type: String },
    publishedAt: { type: Date, required: true },
    authorLogin: { type: String, required: true },
    isPrerelease: { type: Boolean, default: false },
    body: { type: String },
    commitSha: { type: String },
    commitCount: { type: Number, default: 0 },
    features: { type: [String], default: [] },
    bugFixes: { type: [String], default: [] },
    breakingChanges: { type: [String], default: [] },
    dependencyChanges: { type: [String], default: [] },
  },
  { timestamps: true },
);

releaseSchema.index({ repositoryId: 1, publishedAt: -1 });
releaseSchema.index({ repositoryId: 1, tagName: 1 }, { unique: true });

export const Release = typedModel<ReleaseDoc>("Release", releaseSchema);
