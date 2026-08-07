import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { CommitClassification } from "@parallax/shared";

export interface CommitDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  sha: string;
  authorLogin: string;
  authorName: string;
  authorEmail?: string;
  message: string;
  messageTitle: string;
  date: Date;
  additions: number;
  deletions: number;
  filesChanged: number;
  isMerge: boolean;
  classification: CommitClassification;
}

const commitSchema = new Schema<CommitDoc>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    sha: { type: String, required: true },
    authorLogin: { type: String, required: true, index: true },
    authorName: { type: String, required: true },
    authorEmail: { type: String },
    message: { type: String, required: true },
    messageTitle: { type: String, required: true },
    date: { type: Date, required: true },
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    filesChanged: { type: Number, default: 1 },
    isMerge: { type: Boolean, default: false },
    classification: {
      type: String,
      enum: ["feature", "bugfix", "refactor", "docs", "tests", "chore", "dependency"],
      default: "chore",
    },
  },
  { timestamps: true },
);

commitSchema.index({ repositoryId: 1, sha: 1 }, { unique: true });
commitSchema.index({ repositoryId: 1, date: -1 });
commitSchema.index({ repositoryId: 1, authorLogin: 1, date: -1 });
commitSchema.index({ repositoryId: 1, classification: 1 });

export const Commit = typedModel<CommitDoc>("Commit", commitSchema);
