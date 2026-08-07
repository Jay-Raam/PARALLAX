import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { DeploymentStatus } from "@parallax/shared";

export interface DeploymentDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  githubId?: number;
  environment: string;
  ref: string;
  sha: string;
  creatorLogin: string;
  status: DeploymentStatus;
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
  version?: string;
  releaseId?: Schema.Types.ObjectId;
}

const deploymentSchema = new Schema<DeploymentDoc>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    githubId: { type: Number },
    environment: { type: String, required: true, default: "Production" },
    ref: { type: String, default: "main" },
    sha: { type: String, required: true },
    creatorLogin: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILURE", "INACTIVE"], required: true },
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
    version: { type: String },
    releaseId: { type: Schema.Types.ObjectId, ref: "Release" },
  },
  { timestamps: false },
);

deploymentSchema.index({ repositoryId: 1, createdAt: -1 });
deploymentSchema.index({ repositoryId: 1, environment: 1, status: 1 });
deploymentSchema.index({ repositoryId: 1, githubId: 1 });

export const Deployment = typedModel<DeploymentDoc>("Deployment", deploymentSchema);
