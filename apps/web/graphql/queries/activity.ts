import { gql } from "graphql-request";
import { gqlRequest } from "@/lib/gql";
import type { ActivityConnection, ActivityFilter, SearchResults } from "@/types/graphql";

export const ACTIVITY_QUERY = gql`
  query EngineeringActivity($filters: [ActivityFilter!], $pagination: PaginationInput) {
    engineeringActivity(filters: $filters, pagination: $pagination) {
      edges {
        node {
          id
          at
          type
          repositoryId
          repositoryName
          title
          subtitle
          meta
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

export const SEARCH_QUERY = gql`
  query Search($query: String!, $limit: Int) {
    search(query: $query, limit: $limit) {
      repositories {
        id
        name
        fullName
        language
        health {
          overall
          label
        }
      }
      pullRequests {
        id
        repositoryId
        githubNumber
        title
        state
        authorLogin
        risk {
          score
          level
        }
        repository {
          id
          name
        }
      }
      issues {
        id
        repositoryId
        githubNumber
        title
        state
        isStale
        isCritical
        repository {
          id
          name
        }
      }
      commits {
        id
        repositoryId
        sha
        messageTitle
        authorLogin
        date
        repository {
          id
          name
        }
      }
      dependencies {
        id
        name
        ecosystem
        currentVersion
        latestVersion
        risk
        repositoryId
      }
      deployments {
        id
        repositoryId
        environment
        status
        version
        createdAt
        repository {
          id
          name
        }
      }
      contributors {
        id
        login
        name
        role
        commits
        repositoryId
      }
      recommendations {
        id
        type
        priority
        title
        reason
        status
        repository {
          id
          name
        }
      }
    }
  }
`;

export async function fetchActivity(
  filters?: ActivityFilter[],
  pagination?: { first?: number; after?: string },
): Promise<ActivityConnection> {
  const data = await gqlRequest<{ engineeringActivity: ActivityConnection }>(ACTIVITY_QUERY, {
    filters,
    pagination,
  });
  return data.engineeringActivity;
}

export async function fetchSearch(query: string, limit = 6): Promise<SearchResults> {
  const data = await gqlRequest<{ search: SearchResults }>(SEARCH_QUERY, { query, limit });
  return data.search;
}
