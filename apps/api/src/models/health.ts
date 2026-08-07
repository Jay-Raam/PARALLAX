import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";

export interface HealthScoreDoc {
  _id: Schema.Types.ObjectId;
  repositoryId: Schema.Types.ObjectId;
  workspaceId: Schema.Types.ObjectId;
  overall: number;
  breakdown: Record<string, number>;
  change: number;
  explanations: string[];
  risks: string[];
  computedAt: Date;
}

const healthSchema = new Schema<HealthScoreDoc>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    overall: { type: Number, required: true, min: 0, max: 100 },
    breakdown: { type: Schema.Types.Mixed, required: true },
    change: { type: Number, default: 0 },
    explanations: { type: [String], default: [] },
    risks: { type: [String], default: [] },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

healthSchema.index({ repositoryId: 1, computedAt: -1 });
healthSchema.index({ workspaceId: 1, computedAt: -1 });

export const HealthScore = typedModel<HealthScoreDoc>("HealthScore", healthSchema);
