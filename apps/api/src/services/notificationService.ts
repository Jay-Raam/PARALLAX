import type { NotificationType, Severity } from "@parallax/shared";
import { Notification, NotificationPreference, type NotificationDoc } from "../models/notification.js";
import { publishBus } from "../lib/pubsub.js";

export interface NotificationInput {
  workspaceId: string;
  userId?: string;
  type: NotificationType;
  severity: Severity;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  url?: string;
  /** Optional dedupe key — if a notification with the same key exists, skip. */
  dedupeKey?: string;
}

export class NotificationService {
  async create(input: NotificationInput): Promise<NotificationDoc | null> {
    if (input.dedupeKey) {
      const existing = await Notification.findOne({ workspaceId: input.workspaceId, "data.dedupeKey": input.dedupeKey })
        .lean()
        .exec();
      if (existing) return null;
    }

    const preferences = input.userId
      ? await NotificationPreference.findOne({ userId: input.userId, workspaceId: input.workspaceId }).lean().exec()
      : null;
    if (preferences && !preferences.enabled) return null;
    if (preferences && preferences.types && !preferences.types.includes(input.type)) return null;

    const notification = await Notification.create({
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      body: input.body,
      data: { ...input.data, dedupeKey: input.dedupeKey },
      url: input.url,
      createdAt: new Date(),
    });

    await publishBus("notification:created", {
      workspaceId: input.workspaceId,
      notification: notification.toObject(),
    });

    return notification;
  }

  async markRead(notificationId: string): Promise<NotificationDoc | null> {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { readAt: new Date() },
      { new: true },
    )
      .lean()
      .exec();
    return notification;
  }

  async markAllRead(workspaceId: string, userId: string): Promise<void> {
    await Notification.updateMany(
      { workspaceId, $or: [{ userId }, { userId: { $exists: false } }], readAt: { $exists: false } },
      { readAt: new Date() },
    ).exec();
  }

  async unreadCount(workspaceId: string, userId: string): Promise<number> {
    return Notification.countDocuments({
      workspaceId,
      $or: [{ userId }, { userId: { $exists: false } }],
      readAt: { $exists: false },
    }).lean();
  }
}

export const notificationService = new NotificationService();
