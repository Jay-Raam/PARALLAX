import { gql } from "graphql-request";
import { gqlRequest } from "@/lib/gql";
import type {
  AuditLogConnection,
  Notification,
  NotificationConnection,
  NotificationPreferences,
  Recommendation,
  RecommendationConnection,
  RecommendationStatus,
} from "@/types/graphql";

export const RECOMMENDATIONS_QUERY = gql`
  query Recommendations($status: RecommendationStatus, $pagination: PaginationInput) {
    recommendations(status: $status, pagination: $pagination) {
      edges {
        node {
          id
          workspaceId
          repositoryId
          type
          priority
          title
          reason
          evidence
          impact
          suggestedAction
          status
          createdAt
          updatedAt
          repository {
            id
            name
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const NOTIFICATIONS_QUERY = gql`
  query Notifications($pagination: PaginationInput) {
    notifications(pagination: $pagination) {
      edges {
        node {
          id
          workspaceId
          userId
          type
          severity
          title
          body
          data
          readAt
          createdAt
          url
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const UNREAD_NOTIFICATION_COUNT_QUERY = gql`
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`;

export const NOTIFICATION_PREFERENCES_QUERY = gql`
  query NotificationPreferences {
    notificationPreferences {
      enabled
      types
    }
  }
`;

export const AUDIT_LOGS_QUERY = gql`
  query AuditLogs($pagination: PaginationInput) {
    auditLogs(pagination: $pagination) {
      edges {
        node {
          id
          workspaceId
          actorId
          actorName
          action
          targetType
          targetId
          metadata
          ip
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export async function fetchRecommendations(
  status?: RecommendationStatus,
  pagination?: { first?: number; after?: string },
): Promise<RecommendationConnection> {
  const data = await gqlRequest<{ recommendations: RecommendationConnection }>(RECOMMENDATIONS_QUERY, {
    status: status ?? undefined,
    pagination,
  });
  return data.recommendations;
}

export async function fetchNotifications(pagination?: { first?: number; after?: string }): Promise<NotificationConnection> {
  const data = await gqlRequest<{ notifications: NotificationConnection }>(NOTIFICATIONS_QUERY, { pagination });
  return data.notifications;
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const data = await gqlRequest<{ unreadNotificationCount: number }>(UNREAD_NOTIFICATION_COUNT_QUERY);
  return data.unreadNotificationCount;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const data = await gqlRequest<{ notificationPreferences: NotificationPreferences }>(NOTIFICATION_PREFERENCES_QUERY);
  return data.notificationPreferences;
}

export async function fetchAuditLogs(pagination?: { first?: number; after?: string }): Promise<AuditLogConnection> {
  const data = await gqlRequest<{ auditLogs: AuditLogConnection }>(AUDIT_LOGS_QUERY, { pagination });
  return data.auditLogs;
}

export type { Notification, Recommendation };
