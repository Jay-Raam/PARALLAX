import { gql } from "graphql-request";
import { gqlRequest } from "@/lib/gql";
import type { GitHubAccount, User, Workspace, WorkspaceMember } from "@/types/graphql";

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      avatarUrl
      githubLogin
      createdAt
      lastSeenAt
    }
  }
`;

export const WORKSPACES_QUERY = gql`
  query Workspaces {
    workspaces {
      id
      name
      slug
      ownerId
      createdAt
      updatedAt
      health
      members {
        id
        userId
        role
        joinedAt
        user {
          id
          name
          email
          avatarUrl
        }
      }
      settings {
        defaultBranch
        timezone
        syncIntervalMinutes
        healthThreshold
      }
    }
  }
`;

export const MEMBERS_QUERY = gql`
  query Members {
    members {
      id
      workspaceId
      userId
      role
      joinedAt
      user {
        id
        name
        email
        avatarUrl
        githubLogin
      }
    }
  }
`;

export const GITHUB_ACCOUNT_QUERY = gql`
  query GitHubAccount {
    githubAccount {
      id
      githubLogin
      connectedAt
      lastSyncAt
    }
  }
`;

export async function fetchMe(): Promise<User | null> {
  const data = await gqlRequest<{ me: User | null }>(ME_QUERY);
  return data.me;
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const data = await gqlRequest<{ workspaces: Workspace[] }>(WORKSPACES_QUERY);
  return data.workspaces;
}

export async function fetchMembers(): Promise<WorkspaceMember[]> {
  const data = await gqlRequest<{ members: WorkspaceMember[] }>(MEMBERS_QUERY);
  return data.members;
}

export async function fetchGitHubAccount(): Promise<GitHubAccount | null> {
  const data = await gqlRequest<{ githubAccount: GitHubAccount | null }>(GITHUB_ACCOUNT_QUERY);
  return data.githubAccount;
}
