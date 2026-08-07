import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { RiskLevel, Severity, UpdateType } from "@parallax/shared";

export interface DependencyDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  name: string;
  ecosystem: string;
  currentVersion: string;
  latestVersion?: string;
  updateType: UpdateType;
  risk: RiskLevel;
  vulnerabilities: { severity: Severity; advisory?: string }[];
  isDirect: boolean;
  outdated: boolean;
  packageManager?: string;
  publishedAt?: Date;
}

const dependencySchema = new Schema<DependencyDoc>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    name: { type: String, required: true },
    ecosystem: { type: String, default: "npm", index: true },
    currentVersion: { type: String, required: true },
    latestVersion: { type: String },
    updateType: {
      type: String,
      enum: ["NONE", "PATCH", "MINOR", "MAJOR"],
      default: "NONE",
      index: true,
    },
    risk: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "LOW" },
    vulnerabilities: {
      type: [{ severity: String, advisory: String }],
      default: [],
    },
    isDirect: { type: Boolean, default: true },
    outdated: { type: Boolean, default: false },
    packageManager: { type: String },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

dependencySchema.index({ repositoryId: 1, name: 1 }, { unique: true });
dependencySchema.index({ repositoryId: 1, updateType: 1 });
dependencySchema.index({ repositoryId: 1, outdated: 1 });
dependencySchema.index({ repositoryId: 1, "vulnerabilities.severity": 1 });

export const Dependency = typedModel<DependencyDoc>("Dependency", dependencySchema);
