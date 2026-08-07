import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";

export interface IssueDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  githubNumber: number;
  title: string;
  body?: string;
  state: "OPEN" | "CLOSED";
  authorLogin: string;
  createdAt: Date;
  updatedAt?: Date;
  closedAt?: Date;
  labels: string[];
  assignees: string[];
  commentsCount: number;
}

const issueSchema = new Schema<IssueDoc>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    githubNumber: { type: Number, required: true },
    title: { type: String, required: true },
    body: { type: String },
    state: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
    authorLogin: { type: String, required: true, index: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date },
    closedAt: { type: Date },
    labels: { type: [String], default: [] },
    assignees: { type: [String], default: [] },
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: false },
);

issueSchema.index({ repositoryId: 1, githubNumber: 1 }, { unique: true });
issueSchema.index({ repositoryId: 1, state: 1, updatedAt: -1 });
issueSchema.index({ repositoryId: 1, labels: 1 });

export interface IssueCommentDoc {
  _id: Schema.Types.ObjectId;
  issueId: Schema.Types.ObjectId;
  authorLogin: string;
  body: string;
  createdAt: Date;
}

const commentSchema = new Schema<IssueCommentDoc>({
  issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true, index: true },
  authorLogin: { type: String, required: true },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Issue = typedModel<IssueDoc>("Issue", issueSchema);
export const IssueComment = typedModel<IssueCommentDoc>("IssueComment", commentSchema);
