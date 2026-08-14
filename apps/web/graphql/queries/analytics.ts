import { gql } from "graphql-request";
import { gqlRequest } from "@/lib/gql";
import type {
  CICDAnalytics,
  CommitAnalytics,
  ContributorAnalytics,
  DeliveryFunnel,
  DependencyAnalytics,
  DeploymentAnalytics,
  IssueAnalytics,
  PRAnalytics,
  Range,
  ReleaseAnalytics,
  SecurityAnalytics,
} from "@/types/graphql";

export const COMMIT_ANALYTICS_QUERY = gql`
  query CommitAnalytics($repositoryId: ID, $range: Range) {
    commitAnalytics(repositoryId: $repositoryId, range: $range) {
      today
      thisWeek
      thisMonth
      activity {
        date
        commits
      }
      classification {
        classification
        count
      }
      contributors {
        login
        commits
        additions
        deletions
      }
      weeklyDistribution {
        date
        commits
      }
    }
  }
`;

export const PR_ANALYTICS_QUERY = gql`
  query PullRequestAnalytics($repositoryId: ID, $range: Range) {
    pullRequestAnalytics(repositoryId: $repositoryId, range: $range) {
      openCount
      mergedCount
      averageCycleTimeMs
      averageReviewTimeMs
      averageMergeTimeMs
      mergeRate
      cycleTimeSeries {
        date
        pullRequests
      }
      riskDistribution {
        level
        count
      }
    }
  }
`;

export const ISSUE_ANALYTICS_QUERY = gql`
  query IssueAnalytics($repositoryId: ID, $range: Range) {
    issueAnalytics(repositoryId: $repositoryId, range: $range) {
      open
      closed
      stale
      critical
      averageAgeDays
      averageResolutionDays
      resolutionSeries {
        date
        issuesClosed
      }
    }
  }
`;

export const DEPENDENCY_ANALYTICS_QUERY = gql`
  query DependencyAnalytics($repositoryId: ID) {
    dependencyAnalytics(repositoryId: $repositoryId) {
      total
      outdated
      vulnerable
      critical
      byUpdateType {
        updateType
        count
      }
      bySeverity {
        severity
        count
      }
      topOutdated {
        id
        name
        ecosystem
        currentVersion
        latestVersion
        updateType
        risk
        repositoryId
      }
    }
  }
`;

export const SECURITY_ANALYTICS_QUERY = gql`
  query SecurityAnalytics($repositoryId: ID) {
    securityAnalytics(repositoryId: $repositoryId) {
      score
      critical
      high
      medium
      low
      open
      fixed
      byCategory {
        category
        count
      }
      recent {
        id
        repositoryId
        type
        severity
        title
        state
        createdAt
        repository {
          id
          name
        }
      }
    }
  }
`;

export const CICD_ANALYTICS_QUERY = gql`
  query CicdAnalytics($repositoryId: ID, $range: Range) {
    cicdAnalytics(repositoryId: $repositoryId, range: $range) {
      buildSuccessRate
      averageBuildTimeMs
      failedRuns
      successfulRuns
      totalRuns
      deployments
      successSeries {
        date
        buildSuccessRate
        avgBuildTimeMs
      }
      pipelineStages {
        name
        status
        averageMs
        count
      }
    }
  }
`;

export const DEPLOYMENT_ANALYTICS_QUERY = gql`
  query DeploymentAnalytics($repositoryId: ID, $range: Range) {
    deploymentAnalytics(repositoryId: $repositoryId, range: $range) {
      total
      successful
      failed
      byEnvironment {
        environment
        count
      }
      series {
        date
        deployments
      }
      averageTimeToDeployMs
    }
  }
`;

export const RELEASE_ANALYTICS_QUERY = gql`
  query ReleaseAnalytics($repositoryId: ID, $range: Range) {
    releaseAnalytics(repositoryId: $repositoryId, range: $range) {
      total
      prereleases
      averageCommits
      series {
        date
        releases
      }
      latest {
        id
        tagName
        name
        publishedAt
        isPrerelease
        commitCount
        repositoryId
        health {
          score
          label
        }
      }
    }
  }
`;

export const CONTRIBUTOR_ANALYTICS_QUERY = gql`
  query ContributorAnalytics($repositoryId: ID, $range: Range) {
    contributorAnalytics(repositoryId: $repositoryId, range: $range) {
      total
      active30d
      totalCommits
      totalAdditions
      totalDeletions
      busFactor
      commitsByAuthor {
        login
        commits
        additions
        deletions
      }
      activitySeries {
        date
        commits
      }
    }
  }
`;

export const DELIVERY_ANALYTICS_QUERY = gql`
  query DeliveryAnalytics($repositoryId: ID, $range: Range) {
    deliveryAnalytics(repositoryId: $repositoryId, range: $range) {
      stages {
        stage
        from
        to
        averageMs
        count
        changePct
        isBottleneck
      }
      bottleneck {
        stage
        from
        to
        averageMs
        count
        changePct
        isBottleneck
      }
      currentCycleTimeMs
      previousCycleTimeMs
      cycleTimeChangePct
    }
  }
`;

export async function fetchCommitAnalytics(repositoryId?: string, range: Range = "_30D"): Promise<CommitAnalytics> {
  const data = await gqlRequest<{ commitAnalytics: CommitAnalytics }>(COMMIT_ANALYTICS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    range,
  });
  return data.commitAnalytics;
}

export async function fetchPullRequestAnalytics(repositoryId?: string, range: Range = "_30D"): Promise<PRAnalytics> {
  const data = await gqlRequest<{ pullRequestAnalytics: PRAnalytics }>(PR_ANALYTICS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    range,
  });
  return data.pullRequestAnalytics;
}

export async function fetchIssueAnalytics(repositoryId?: string, range: Range = "_30D"): Promise<IssueAnalytics> {
  const data = await gqlRequest<{ issueAnalytics: IssueAnalytics }>(ISSUE_ANALYTICS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    range,
  });
  return data.issueAnalytics;
}

export async function fetchDependencyAnalytics(repositoryId?: string): Promise<DependencyAnalytics> {
  const data = await gqlRequest<{ dependencyAnalytics: DependencyAnalytics }>(DEPENDENCY_ANALYTICS_QUERY, {
    repositoryId: repositoryId ?? undefined,
  });
  return data.dependencyAnalytics;
}

export async function fetchSecurityAnalytics(repositoryId?: string): Promise<SecurityAnalytics> {
  const data = await gqlRequest<{ securityAnalytics: SecurityAnalytics }>(SECURITY_ANALYTICS_QUERY, {
    repositoryId: repositoryId ?? undefined,
  });
  return data.securityAnalytics;
}

export async function fetchCicdAnalytics(repositoryId?: string, range: Range = "_30D"): Promise<CICDAnalytics> {
  const data = await gqlRequest<{ cicdAnalytics: CICDAnalytics }>(CICD_ANALYTICS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    range,
  });
  return data.cicdAnalytics;
}

export async function fetchDeploymentAnalytics(repositoryId?: string, range: Range = "_30D"): Promise<DeploymentAnalytics> {
  const data = await gqlRequest<{ deploymentAnalytics: DeploymentAnalytics }>(DEPLOYMENT_ANALYTICS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    range,
  });
  return data.deploymentAnalytics;
}

export async function fetchReleaseAnalytics(repositoryId?: string, range: Range = "_30D"): Promise<ReleaseAnalytics> {
  const data = await gqlRequest<{ releaseAnalytics: ReleaseAnalytics }>(RELEASE_ANALYTICS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    range,
  });
  return data.releaseAnalytics;
}

export async function fetchContributorAnalytics(repositoryId?: string, range: Range = "_30D"): Promise<ContributorAnalytics> {
  const data = await gqlRequest<{ contributorAnalytics: ContributorAnalytics }>(CONTRIBUTOR_ANALYTICS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    range,
  });
  return data.contributorAnalytics;
}

export async function fetchDeliveryAnalytics(repositoryId?: string, range: Range = "_30D"): Promise<DeliveryFunnel> {
  const data = await gqlRequest<{ deliveryAnalytics: DeliveryFunnel }>(DELIVERY_ANALYTICS_QUERY, {
    repositoryId: repositoryId ?? undefined,
    range,
  });
  return data.deliveryAnalytics;
}
