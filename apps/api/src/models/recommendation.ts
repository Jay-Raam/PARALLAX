import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { Priority, RecommendationStatus, RecommendationType } from "@parallax/shared";

export interface RecommendationDoc {
  _id: Schema.Types.ObjectId;
  workspaceId: Schema.Types.ObjectId;
  repositoryId?: Schema.Types.ObjectId;
  type: RecommendationType;
  priority: Priority;
  title: string;
  reason: string;
  evidence: Record<string, unknown>;
  impact: string;
  suggestedAction: string;
  status: RecommendationStatus;
  dedupeKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const recommendationSchema = new Schema<RecommendationDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", index: true },
    type: {
      type: String,
      enum: [
        "DEPENDENCY_UPDATE",
        "SECURITY_VULNERABILITY",
        "STALE_ISSUES",
        "SLOW_REVIEWS",
        "CI_FAILURES",
        "DEPLOYMENT_FAILURES",
        "TESTING_GAPS",
        "DOCUMENTATION_INACTIVITY",
        "SECURITY_POSTURE",
        "DELIVERY_BOTTLENECK",
      ],
      required: true,
    },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], required: true },
    title: { type: String, required: true },
    reason: { type: String, required: true },
    evidence: { type: Schema.Types.Mixed, default: {} },
    impact: { type: String, required: true },
    suggestedAction: { type: String, required: true },
    status: { type: String, enum: ["ACTIVE", "COMPLETED", "DISMISSED"], default: "ACTIVE" },
    dedupeKey: { type: String, required: true },
  },
  { timestamps: true },
);

recommendationSchema.index({ workspaceId: 1, status: 1, priority: 1 });
recommendationSchema.index({ workspaceId: 1, repositoryId: 1, dedupeKey: 1 }, { unique: true });

export const Recommendation = typedModel<RecommendationDoc>("Recommendation", recommendationSchema);
