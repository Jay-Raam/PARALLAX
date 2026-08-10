import type { AuditAction } from "@parallax/shared";
import { AuditLog } from "../models/auditLog.js";

export interface AuditInput {
  workspaceId: string;
  actorId: string;
  actorName?: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export class AuditService {
  async log(input: AuditInput): Promise<void> {
    try {
      await AuditLog.create(input);
    } catch (err) {
      // Audit failures must never break the main flow
      console.error("Audit log write failed", (err as Error).message);
    }
  }
}

export const auditService = new AuditService();
