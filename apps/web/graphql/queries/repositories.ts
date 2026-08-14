import { gql } from "graphql-request";
import { gqlRequest } from "@/lib/gql";
import type {
  AvailableRepository,
  Branch,
  Range,
  Repository,
  RepositoryComparisonItem,
  RepositoryConnection,
  RepositoryFilters,
  RepositoryHealth,
  SyncJob,
} from "@/types/graphql";

export const REPOSITORIES_QUERY = gql`
  query Repositories($filters: RepositoryFilters, $pagination: PaginationInput) {
    repositories(filters: $filters, pagination: $pagination) {
      edges {
        node {
          id
          workspaceId
          githubId
          name
          fullName
          owner
          description
          url
          defaultBranch
          isPrivate
          language
          techStack
          topics
          fork
          archived
          createdAt
          pushedAt
          starCount
          forkCount
          openIssuesCount
          syncStatus
          lastSyncedAt
          source
          enabled
          lastActivityAt
          counts {
            commits
            openPrs
            mergedPrs
            openIssues
            closedIssues
            dependencies
            outdatedDependencies
            securityAlerts
            deployments
            releases
            contributors
          }
          health {
            overall
            label
            change
            computedAt
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const REPOSITORY_QUERY = gql`
  query Repository($id: ID!) {
    repository(id: $id) {
      id
      workspaceId
      githubId
      name
      fullName
      owner
      description
      url
      defaultBranch
      isPrivate
      language
      techStack
      topics
      fork
      archived
      createdAt
      pushedAt
      starCount
      forkCount
      openIssuesCount
      syncStatus
      lastSyncedAt
      source
      enabled
      lastActivityAt
      counts {
        commits
        openPrs
        mergedPrs
        openIssues
        closedIssues
        dependencies
        outdatedDependencies
        securityAlerts
        deployments
        releases
        contributors
      }
      health {
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
  }
`;

export const REPOSITORY_HEALTH_QUERY = gql`
  query RepositoryHealth($id: ID!, $range: Range) {
    repositoryHealth(id: $id, range: $range) {
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

export const BRANCHES_QUERY = gql`
  query Branches($repositoryId: ID!) {
    branches(repositoryId: $repositoryId) {
      id
      name
      headSha
      isDefault
      lastCommitAt
    }
  }
`;

export const AVAILABLE_REPOSITORIES_QUERY = gql`
  query AvailableRepositories {
    availableRepositories {
      githubId
      name
      fullName
      language
      description
      isPrivate
      connected
    }
  }
`;

export const REPOSITORY_COMPARISON_QUERY = gql`
  query RepositoryComparison($range: Range) {
    repositoryComparison(range: $range) {
      repositoryId
      name
      health
      commits
      pullRequests
      cycleTimeMs
      buildSuccessRate
      contributors
      openIssues
      staleIssues
    }
  }
`;

export const SYNC_JOB_QUERY = gql`
  query SyncJob($repositoryId: ID!) {
    syncJob(repositoryId: $repositoryId) {
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

export async function fetchRepositories(
  filters?: RepositoryFilters,
  pagination?: { first?: number; after?: string },
): Promise<RepositoryConnection> {
  const data = await gqlRequest<{ repositories: RepositoryConnection }>(REPOSITORIES_QUERY, {
    filters,
    pagination,
  });
  return data.repositories;
}

export async function fetchRepository(id: string): Promise<Repository> {
  const data = await gqlRequest<{ repository: Repository }>(REPOSITORY_QUERY, { id });
  return data.repository;
}

export async function fetchRepositoryHealth(id: string, range: Range = "_30D"): Promise<RepositoryHealth> {
  const data = await gqlRequest<{ repositoryHealth: RepositoryHealth }>(REPOSITORY_HEALTH_QUERY, { id, range });
  return data.repositoryHealth;
}

export async function fetchBranches(repositoryId: string): Promise<Branch[]> {
  const data = await gqlRequest<{ branches: Branch[] }>(BRANCHES_QUERY, { repositoryId });
  return data.branches;
}

export async function fetchAvailableRepositories(): Promise<AvailableRepository[]> {
  const data = await gqlRequest<{ availableRepositories: AvailableRepository[] }>(AVAILABLE_REPOSITORIES_QUERY);
  return data.availableRepositories;
}

export async function fetchRepositoryComparison(range: Range = "_30D"): Promise<RepositoryComparisonItem[]> {
  const data = await gqlRequest<{ repositoryComparison: RepositoryComparisonItem[] }>(REPOSITORY_COMPARISON_QUERY, {
    range,
  });
  return data.repositoryComparison;
}

export async function fetchSyncJob(repositoryId: string): Promise<SyncJob | null> {
  const data = await gqlRequest<{ syncJob: SyncJob | null }>(SYNC_JOB_QUERY, { repositoryId });
  return data.syncJob;
}
