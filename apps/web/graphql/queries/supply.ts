import { gql } from "graphql-request";
import { gqlRequest } from "@/lib/gql";
import type {
  Contributor,
  ContributorConnection,
  Dependency,
  DependencyConnection,
  DependencyFilters,
  Deployment,
  DeploymentConnection,
  Release,
  ReleaseConnection,
  SecurityAlert,
  SecurityAlertConnection,
  SecurityFilters,
  Workflow,
  WorkflowFilters,
  WorkflowRun,
  WorkflowRunConnection,
} from "@/types/graphql";

export const DEPENDENCIES_QUERY = gql`
  query Dependencies($repositoryId: ID, $filters: DependencyFilters, $pagination: PaginationInput) {
    dependencies(repositoryId: $repositoryId, filters: $filters, pagination: $pagination) {
      edges {
        node {
          id
          repositoryId
          name
          ecosystem
          currentVersion
          latestVersion
          updateType
          risk
          vulnerabilities {
            severity
            advisory
          }
          isDirect
          outdated
          packageManager
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

export const SECURITY_ALERTS_QUERY = gql`
  query SecurityAlerts($repositoryId: ID, $filters: SecurityFilters, $pagination: PaginationInput) {
    securityAlerts(repositoryId: $repositoryId, filters: $filters, pagination: $pagination) {
      edges {
        node {
          id
          repositoryId
          type
          severity
          title
          description
          state
          createdAt
          url
          packageName
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

export const WORKFLOWS_QUERY = gql`
  query Workflows($repositoryId: ID!) {
    workflows(repositoryId: $repositoryId) {
      id
      repositoryId
      name
      path
      state
    }
  }
`;

export const WORKFLOW_RUNS_QUERY = gql`
  query WorkflowRuns($repositoryId: ID, $filters: WorkflowFilters, $pagination: PaginationInput) {
    workflowRuns(repositoryId: $repositoryId, filters: $filters, pagination: $pagination) {
      edges {
        node {
          id
          repositoryId
          workflowId
          workflowName
          runNumber
          event
          status
          headSha
          branch
          createdAt
          updatedAt
          durationMs
          steps {
            name
            status
            conclusion
            durationMs
          }
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

export const DEPLOYMENTS_QUERY = gql`
  query Deployments($repositoryId: ID, $pagination: PaginationInput) {
    deployments(repositoryId: $repositoryId, pagination: $pagination) {
      edges {
        node {
          id
          repositoryId
          environment
          ref
          sha
          creatorLogin
          status
          description
          createdAt
          updatedAt
          version
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

export const RELEASES_QUERY = gql`
  query Releases($repositoryId: ID, $pagination: PaginationInput) {
    releases(repositoryId: $repositoryId, pagination: $pagination) {
      edges {
        node {
          id
          repositoryId
          tagName
          name
          publishedAt
          authorLogin
          isPrerelease
          body
          commitCount
          features
          bugFixes
          breakingChanges
          dependencyChanges
          health {
            score
            label
            features
            bugFixes
            breakingChanges
            dependencyChanges
            commitCount
            explanation
          }
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

export const CONTRIBUTORS_QUERY = gql`
  query Contributors($repositoryId: ID, $pagination: PaginationInput) {
    contributors(repositoryId: $repositoryId, pagination: $pagination) {
      edges {
        node {
          id
          repositoryId
          login
          name
          avatarUrl
          role
          commits
          additions
          deletions
          pullRequestsCreated
          reviewsGiven
          issuesOpened
          issuesClosed
          firstContributionAt
          lastContributionAt
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

export async function fetchDependencies(
  repositoryId: string | undefined,
  filters?: DependencyFilters,
  pagination?: { first?: number; after?: string },
): Promise<DependencyConnection> {
  const data = await gqlRequest<{ dependencies: DependencyConnection }>(DEPENDENCIES_QUERY, {
    repositoryId: repositoryId ?? undefined,
    filters,
    pagination,
  });
  return data.dependencies;
}

export async function fetchSecurityAlerts(
  repositoryId: string | undefined,
  filters?: SecurityFilters,
  pagination?: { first?: number; after?: string },
): Promise<SecurityAlertConnection> {
  const data = await gqlRequest<{ securityAlerts: SecurityAlertConnection }>(SECURITY_ALERTS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    filters,
    pagination,
  });
  return data.securityAlerts;
}

export async function fetchWorkflows(repositoryId: string): Promise<Workflow[]> {
  const data = await gqlRequest<{ workflows: Workflow[] }>(WORKFLOWS_QUERY, { repositoryId });
  return data.workflows;
}

export async function fetchWorkflowRuns(
  repositoryId: string | undefined,
  filters?: WorkflowFilters,
  pagination?: { first?: number; after?: string },
): Promise<WorkflowRunConnection> {
  const data = await gqlRequest<{ workflowRuns: WorkflowRunConnection }>(WORKFLOW_RUNS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    filters,
    pagination,
  });
  return data.workflowRuns;
}

export async function fetchDeployments(
  repositoryId: string | undefined,
  pagination?: { first?: number; after?: string },
): Promise<DeploymentConnection> {
  const data = await gqlRequest<{ deployments: DeploymentConnection }>(DEPLOYMENTS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    pagination,
  });
  return data.deployments;
}

export async function fetchReleases(
  repositoryId: string | undefined,
  pagination?: { first?: number; after?: string },
): Promise<ReleaseConnection> {
  const data = await gqlRequest<{ releases: ReleaseConnection }>(RELEASES_QUERY, {
    repositoryId: repositoryId ?? undefined,
    pagination,
  });
  return data.releases;
}

export async function fetchContributors(
  repositoryId: string | undefined,
  pagination?: { first?: number; after?: string },
): Promise<ContributorConnection> {
  const data = await gqlRequest<{ contributors: ContributorConnection }>(CONTRIBUTORS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    pagination,
  });
  return data.contributors;
}

export type { Contributor, Dependency, Deployment, Release, SecurityAlert, WorkflowRun };
