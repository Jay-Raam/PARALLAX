import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";
import type { AuditAction } from "@parallax/shared";

export interface AuditLogDoc {
  _id: Schema.Types.ObjectId;
  workspaceId: Schema.Types.ObjectId;
  actorId: Schema.Types.ObjectId;
  actorName?: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String },
    action: {
      type: String,
      enum: [
        "LOGIN",
        "LOGOUT",
        "GITHUB_CONNECTED",
        "GITHUB_DISCONNECTED",
        "REPOSITORY_CONNECTED",
        "REPOSITORY_DISCONNECTED",
        "REPOSITORY_SYNCED",
        "WORKSPACE_CREATED",
        "WORKSPACE_UPDATED",
        "MEMBER_ADDED",
        "MEMBER_REMOVED",
        "ROLE_CHANGED",
        "SETTINGS_UPDATED",
      ],
      required: true,
    },
    targetType: { type: String },
    targetId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

auditLogSchema.index({ workspaceId: 1, createdAt: -1 });
auditLogSchema.index({ workspaceId: 1, action: 1 });

export const AuditLog = typedModel<AuditLogDoc>("AuditLog", auditLogSchema);
