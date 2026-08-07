import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";

export interface GitHubAccountDoc {
  _id: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  workspaceId?: Schema.Types.ObjectId;
  githubLogin: string;
  githubId: number;
  /** AES-256-GCM encrypted OAuth token */
  accessTokenEncrypted: string;
  tokenScope?: string;
  connectedAt: Date;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const githubAccountSchema = new Schema<GitHubAccountDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", index: true },
    githubLogin: { type: String, required: true, index: true },
    githubId: { type: Number, required: true, unique: true, index: true },
    accessTokenEncrypted: { type: String, required: true },
    tokenScope: { type: String },
    connectedAt: { type: Date, default: Date.now },
    lastSyncAt: { type: Date },
  },
  { timestamps: true },
);

export const GitHubAccount = typedModel<GitHubAccountDoc>("GitHubAccount", githubAccountSchema);
