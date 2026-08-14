import { gql } from "graphql-request";
import type { DocumentNode } from "graphql";
import type { Deployment, Notification, RepositoryHealth, SyncJob, WorkflowRun } from "@/types/graphql";

export function subDoc(doc: string | DocumentNode): string {
  return typeof doc === "string" ? doc : (doc.loc?.source.body ?? String(doc));
}

export const SYNC_PROGRESS_SUBSCRIPTION = gql`
  subscription SyncProgressUpdated($repositoryId: ID!) {
    syncProgressUpdated(repositoryId: $repositoryId) {
      id
      workspaceId
      repositoryId
      type
      status
      progress {
        phase
        current
        total
        percent
      }
      stats
      error
      startedAt
      completedAt
      triggeredBy
    }
  }
`;

export const NOTIFICATION_CREATED_SUBSCRIPTION = gql`
  subscription NotificationCreated {
    notificationCreated {
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
  }
`;

export const HEALTH_UPDATED_SUBSCRIPTION = gql`
  subscription RepositoryHealthUpdated($repositoryId: ID) {
    repositoryHealthUpdated(repositoryId: $repositoryId) {
      repositoryId
      overall
      label
      change
      breakdown {
        key
        label
        score
        weight
      }
      trend {
        date
        score
      }
      explanations
      risks
      computedAt
    }
  }
`;

export const WORKFLOW_UPDATED_SUBSCRIPTION = gql`
  subscription WorkflowRunUpdated($repositoryId: ID) {
    workflowRunUpdated(repositoryId: $repositoryId) {
      id
      repositoryId
      workflowName
      runNumber
      status
      branch
      createdAt
      durationMs
    }
  }
`;

export const DEPLOYMENT_UPDATED_SUBSCRIPTION = gql`
  subscription DeploymentUpdated($repositoryId: ID) {
    deploymentUpdated(repositoryId: $repositoryId) {
      id
      repositoryId
      environment
      status
      version
      description
      createdAt
    }
  }
`;

export type { Deployment, Notification, RepositoryHealth, SyncJob, WorkflowRun };
