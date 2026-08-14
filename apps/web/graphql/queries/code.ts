import { gql } from "graphql-request";
import { gqlRequest } from "@/lib/gql";
import type {
  CommitConnection,
  CommitFilters,
  Issue,
  IssueConnection,
  IssueFilters,
  PullRequest,
  PullRequestConnection,
  PullRequestFilters,
} from "@/types/graphql";

export const COMMITS_QUERY = gql`
  query Commits($repositoryId: ID!, $filters: CommitFilters, $pagination: PaginationInput) {
    commits(repositoryId: $repositoryId, filters: $filters, pagination: $pagination) {
      edges {
        node {
          id
          repositoryId
          sha
          authorLogin
          authorName
          message
          messageTitle
          date
          additions
          deletions
          filesChanged
          isMerge
          classification
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

export const PULL_REQUESTS_QUERY = gql`
  query PullRequests($repositoryId: ID, $filters: PullRequestFilters, $pagination: PaginationInput) {
    pullRequests(repositoryId: $repositoryId, filters: $filters, pagination: $pagination) {
      edges {
        node {
          id
          repositoryId
          githubNumber
          title
          state
          authorLogin
          createdAt
          updatedAt
          mergedAt
          baseRef
          headRef
          additions
          deletions
          changedFiles
          commits
          isDraft
          labels
          reviewDecision
          testFilesChanged
          dependenciesChanged
          authFilesChanged
          migrationFilesChanged
          risk {
            score
            level
            factors
            explanation
          }
          reviewTimeMs
          approvalTimeMs
          mergeTimeMs
          deployTimeMs
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

export const PULL_REQUEST_QUERY = gql`
  query PullRequest($id: ID!) {
    pullRequest(id: $id) {
      id
      repositoryId
      githubNumber
      title
      body
      state
      authorLogin
      createdAt
      updatedAt
      closedAt
      mergedAt
      baseRef
      headRef
      additions
      deletions
      changedFiles
      commits
      isDraft
      labels
      reviewDecision
      testFilesChanged
      dependenciesChanged
      authFilesChanged
      migrationFilesChanged
      files
      risk {
        score
        level
        factors
        explanation
      }
      reviewTimeMs
      approvalTimeMs
      mergeTimeMs
      deployTimeMs
      lifecycle {
        stage
        at
      }
      reviews {
        id
        reviewerLogin
        state
        submittedAt
        body
      }
      repository {
        id
        name
        fullName
        url
      }
      author {
        id
        login
        name
        avatarUrl
      }
    }
  }
`;

export const ISSUES_QUERY = gql`
  query Issues($repositoryId: ID, $filters: IssueFilters, $pagination: PaginationInput) {
    issues(repositoryId: $repositoryId, filters: $filters, pagination: $pagination) {
      edges {
        node {
          id
          repositoryId
          githubNumber
          title
          state
          authorLogin
          createdAt
          updatedAt
          closedAt
          labels
          assignees
          commentsCount
          daysInactive
          isStale
          isCritical
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

export const ISSUE_QUERY = gql`
  query Issue($id: ID!) {
    issue(id: $id) {
      id
      repositoryId
      githubNumber
      title
      body
      state
      authorLogin
      createdAt
      updatedAt
      closedAt
      labels
      assignees
      commentsCount
      daysInactive
      isStale
      isCritical
      repository {
        id
        name
        fullName
        url
      }
    }
  }
`;

export async function fetchCommits(
  repositoryId: string,
  filters?: CommitFilters,
  pagination?: { first?: number; after?: string },
): Promise<CommitConnection> {
  const data = await gqlRequest<{ commits: CommitConnection }>(COMMITS_QUERY, {
    repositoryId,
    filters,
    pagination,
  });
  return data.commits;
}

export async function fetchPullRequests(
  repositoryId: string | undefined,
  filters?: PullRequestFilters,
  pagination?: { first?: number; after?: string },
): Promise<PullRequestConnection> {
  const data = await gqlRequest<{ pullRequests: PullRequestConnection }>(PULL_REQUESTS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    filters,
    pagination,
  });
  return data.pullRequests;
}

export async function fetchPullRequest(id: string): Promise<PullRequest> {
  const data = await gqlRequest<{ pullRequest: PullRequest }>(PULL_REQUEST_QUERY, { id });
  return data.pullRequest;
}

export async function fetchIssues(
  repositoryId: string | undefined,
  filters?: IssueFilters,
  pagination?: { first?: number; after?: string },
): Promise<IssueConnection> {
  const data = await gqlRequest<{ issues: IssueConnection }>(ISSUES_QUERY, {
    repositoryId: repositoryId ?? undefined,
    filters,
    pagination,
  });
  return data.issues;
}

export async function fetchIssue(id: string): Promise<Issue | null> {
  const data = await gqlRequest<{ issue: Issue | null }>(ISSUE_QUERY, { id });
  return data.issue;
}
