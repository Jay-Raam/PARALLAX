import { gql } from "graphql-request";
import { gqlRequest } from "@/lib/gql";
import type { EngineeringOverview } from "@/types/graphql";

export const OVERVIEW_QUERY = gql`
  query EngineeringOverview {
    engineeringOverview {
      health
      healthChange
      repositories
      openPrs
      openIssues
      deployments
      securityAlerts
      commits30d
      topRisks
      bottleneck
      recommendations {
        id
        type
        priority
        title
        reason
        impact
        suggestedAction
        status
        createdAt
        repository {
          id
          name
        }
      }
      healthTrend {
        date
        score
      }
      activity {
        edges {
          node {
            id
            at
            type
            repositoryId
            repositoryName
            title
            subtitle
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
      recentDeployments {
        id
        repositoryId
        environment
        status
        version
        description
        createdAt
      }
    }
  }
`;

export async function fetchOverview(): Promise<EngineeringOverview> {
  const data = await gqlRequest<{ engineeringOverview: EngineeringOverview }>(OVERVIEW_QUERY);
  return data.engineeringOverview;
}
