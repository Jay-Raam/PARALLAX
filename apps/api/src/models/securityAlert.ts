import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { SecurityCategory, Severity } from "@parallax/shared";

export interface SecurityAlertDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  githubId?: number;
  type: SecurityCategory;
  severity: Severity;
  title: string;
  description?: string;
  state: "OPEN" | "FIXED" | "DISMISSED";
  createdAt: Date;
  dismissedAt?: Date;
  url?: string;
  packageName?: string;
  affectedVersion?: string;
  fixedVersion?: string;
}

const securityAlertSchema = new Schema<SecurityAlertDoc>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    githubId: { type: Number },
    type: {
      type: String,
      enum: [
        "DEPENDABOT",
        "SECRET_SCANNING",
        "CODE_SCANNING",
        "WORKFLOW_SECURITY",
        "DEPENDENCY_VULNERABILITIES",
        "REPOSITORY_PERMISSIONS",
        "BRANCH_PROTECTION",
      ],
      required: true,
    },
    severity: { type: String, enum: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true },
    title: { type: String, required: true },
    description: { type: String },
    state: { type: String, enum: ["OPEN", "FIXED", "DISMISSED"], default: "OPEN" },
    createdAt: { type: Date, default: Date.now },
    dismissedAt: { type: Date },
    url: { type: String },
    packageName: { type: String },
    affectedVersion: { type: String },
    fixedVersion: { type: String },
  },
  { timestamps: true },
);

securityAlertSchema.index({ repositoryId: 1, state: 1, severity: 1 });
securityAlertSchema.index({ repositoryId: 1, type: 1 });
securityAlertSchema.index({ repositoryId: 1, createdAt: -1 });
securityAlertSchema.index({ repositoryId: 1, githubId: 1 }, { unique: true, sparse: true });

export const SecurityAlert = typedModel<SecurityAlertDoc>("SecurityAlert", securityAlertSchema);
