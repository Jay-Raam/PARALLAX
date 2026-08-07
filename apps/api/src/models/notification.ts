import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { NotificationType, Severity } from "@parallax/shared";

export interface NotificationDoc {
  _id: Schema.Types.ObjectId;
  workspaceId: Schema.Types.ObjectId;
  userId?: Schema.Types.ObjectId;
  type: NotificationType;
  severity: Severity;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  readAt?: Date;
  url?: string;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    type: {
      type: String,
      enum: [
        "PR_RISK",
        "SECURITY_VULNERABILITY",
        "CI_FAILURE",
        "DEPLOYMENT_FAILURE",
        "HEALTH_DROP",
        "DEPENDENCY_VULNERABILITY",
        "RECOMMENDATION",
        "SYNC_COMPLETE",
      ],
      required: true,
    },
    severity: { type: String, enum: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "INFO" },
    title: { type: String, required: true },
    body: { type: String },
    data: { type: Schema.Types.Mixed },
    readAt: { type: Date },
    url: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ workspaceId: 1, createdAt: -1 });

export interface NotificationPreferenceDoc {
  _id: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  workspaceId?: Schema.Types.ObjectId;
  enabled: boolean;
  types: NotificationType[];
}

const prefSchema = new Schema<NotificationPreferenceDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace" },
    enabled: { type: Boolean, default: true },
    types: {
      type: [String],
      enum: [
        "PR_RISK",
        "SECURITY_VULNERABILITY",
        "CI_FAILURE",
        "DEPLOYMENT_FAILURE",
        "HEALTH_DROP",
        "DEPENDENCY_VULNERABILITY",
        "RECOMMENDATION",
        "SYNC_COMPLETE",
      ],
      default: [
        "PR_RISK",
        "SECURITY_VULNERABILITY",
        "CI_FAILURE",
        "DEPLOYMENT_FAILURE",
        "HEALTH_DROP",
        "DEPENDENCY_VULNERABILITY",
        "RECOMMENDATION",
        "SYNC_COMPLETE",
      ],
    },
  },
  { timestamps: true },
);

prefSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });

export const Notification = typedModel<NotificationDoc>("Notification", notificationSchema);
export const NotificationPreference = typedModel<NotificationPreferenceDoc>("NotificationPreference", prefSchema);
