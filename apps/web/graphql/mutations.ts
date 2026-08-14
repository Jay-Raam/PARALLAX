import { gql } from "graphql-request";
import { gqlRequest } from "@/lib/gql";
import type {
  AuthPayload,
  ConnectGitHubPayload,
  GitHubAccount,
  Notification,
  NotificationPreferences,
  NotificationType,
  Recommendation,
  Repository,
  Role,
  SyncJob,
  User,
  Workspace,
  WorkspaceMember,
} from "@/types/graphql";

const LOGIN_MUTATION = gql`
  mutation Login($email: String!) {
    login(email: $email) {
      user {
        id
        email
        name
        avatarUrl
        githubLogin
      }
      workspace {
        id
        name
        slug
      }
    }
  }
`;

const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

const CREATE_WORKSPACE_MUTATION = gql`
  mutation CreateWorkspace($name: String!) {
    createWorkspace(name: $name) {
      id
      name
      slug
    }
  }
`;

const SWITCH_WORKSPACE_MUTATION = gql`
  mutation SwitchWorkspace($id: ID!) {
    switchWorkspace(id: $id) {
      id
      name
      slug
    }
  }
`;

const UPDATE_WORKSPACE_MUTATION = gql`
  mutation UpdateWorkspace($id: ID!, $input: UpdateWorkspaceInput!) {
    updateWorkspace(id: $id, input: $input) {
      id
      name
      slug
      settings {
        defaultBranch
        timezone
        syncIntervalMinutes
        healthThreshold
      }
    }
  }
`;

const ADD_MEMBER_MUTATION = gql`
  mutation AddMember($input: AddMemberInput!) {
    addMember(input: $input) {
      id
      userId
      role
      user {
        id
        name
        email
      }
    }
  }
`;

const UPDATE_MEMBER_ROLE_MUTATION = gql`
  mutation UpdateMemberRole($input: UpdateRoleInput!) {
    updateMemberRole(input: $input) {
      id
      userId
      role
      user {
        id
        name
        email
      }
    }
  }
`;

const REMOVE_MEMBER_MUTATION = gql`
  mutation RemoveMember($userId: ID!) {
    removeMember(userId: $userId)
  }
`;

const CONNECT_GITHUB_MUTATION = gql`
  mutation ConnectGitHub($code: String!) {
    connectGitHub(code: $code) {
      githubAccount {
        id
        githubLogin
        connectedAt
      }
      repositories {
        totalCount
      }
    }
  }
`;

const DISCONNECT_GITHUB_MUTATION = gql`
  mutation DisconnectGitHub {
    disconnectGitHub
  }
`;

const CONNECT_REPOSITORY_MUTATION = gql`
  mutation ConnectRepository($githubId: Int!) {
    connectRepository(githubId: $githubId) {
      id
      name
      syncStatus
      counts {
        commits
        openPrs
        openIssues
      }
    }
  }
`;

const DISCONNECT_REPOSITORY_MUTATION = gql`
  mutation DisconnectRepository($repositoryId: ID!) {
    disconnectRepository(repositoryId: $repositoryId)
  }
`;

const SYNC_REPOSITORY_MUTATION = gql`
  mutation SyncRepository($repositoryId: ID!, $incremental: Boolean) {
    syncRepository(repositoryId: $repositoryId, incremental: $incremental) {
      syncJob {
        id
        repositoryId
        type
        status
        progress {
          phase
          current
          total
          percent
        }
      }
    }
  }
`;

const SYNC_WORKSPACE_MUTATION = gql`
  mutation SyncWorkspace {
    syncWorkspace {
      syncJob {
        id
        repositoryId
        type
        status
        progress {
          phase
          current
          total
          percent
        }
      }
    }
  }
`;

const UPDATE_PROFILE_MUTATION = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      name
      email
      avatarUrl
    }
  }
`;

const UPDATE_NOTIFICATION_PREFERENCES_MUTATION = gql`
  mutation UpdateNotificationPreferences($input: NotificationPreferenceInput!) {
    updateNotificationPreferences(input: $input) {
      enabled
      types
    }
  }
`;

const MARK_RECOMMENDATION_COMPLETE_MUTATION = gql`
  mutation MarkRecommendationComplete($id: ID!) {
    markRecommendationComplete(id: $id) {
      id
      status
    }
  }
`;

const DISMISS_RECOMMENDATION_MUTATION = gql`
  mutation DismissRecommendation($id: ID!) {
    dismissRecommendation(id: $id) {
      id
      status
    }
  }
`;

const MARK_NOTIFICATION_READ_MUTATION = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      readAt
    }
  }
`;

const MARK_ALL_NOTIFICATIONS_READ_MUTATION = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

export async function login(email: string): Promise<AuthPayload> {
  const data = await gqlRequest<{ login: AuthPayload }>(LOGIN_MUTATION, { email });
  return data.login;
}

export async function logout(): Promise<boolean> {
  const data = await gqlRequest<{ logout: boolean }>(LOGOUT_MUTATION);
  return data.logout;
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const data = await gqlRequest<{ createWorkspace: Workspace }>(CREATE_WORKSPACE_MUTATION, { name });
  return data.createWorkspace;
}

export async function switchWorkspace(id: string): Promise<Workspace> {
  const data = await gqlRequest<{ switchWorkspace: Workspace }>(SWITCH_WORKSPACE_MUTATION, { id });
  return data.switchWorkspace;
}

export async function updateWorkspace(id: string, input: { name?: string; slug?: string; settings?: Record<string, unknown> }): Promise<Workspace> {
  const data = await gqlRequest<{ updateWorkspace: Workspace }>(UPDATE_WORKSPACE_MUTATION, { id, input });
  return data.updateWorkspace;
}

export async function addMember(input: { email: string; role: Role }): Promise<WorkspaceMember> {
  const data = await gqlRequest<{ addMember: WorkspaceMember }>(ADD_MEMBER_MUTATION, { input });
  return data.addMember;
}

export async function updateMemberRole(input: { userId: string; role: Role }): Promise<WorkspaceMember> {
  const data = await gqlRequest<{ updateMemberRole: WorkspaceMember }>(UPDATE_MEMBER_ROLE_MUTATION, { input });
  return data.updateMemberRole;
}

export async function removeMember(userId: string): Promise<boolean> {
  const data = await gqlRequest<{ removeMember: boolean }>(REMOVE_MEMBER_MUTATION, { userId });
  return data.removeMember;
}

export async function connectGitHub(code: string): Promise<ConnectGitHubPayload> {
  const data = await gqlRequest<{ connectGitHub: ConnectGitHubPayload }>(CONNECT_GITHUB_MUTATION, { code });
  return data.connectGitHub;
}

export async function disconnectGitHub(): Promise<boolean> {
  const data = await gqlRequest<{ disconnectGitHub: boolean }>(DISCONNECT_GITHUB_MUTATION);
  return data.disconnectGitHub;
}

export async function connectRepository(githubId: number): Promise<Repository> {
  const data = await gqlRequest<{ connectRepository: Repository }>(CONNECT_REPOSITORY_MUTATION, { githubId });
  return data.connectRepository;
}

export async function disconnectRepository(repositoryId: string): Promise<boolean> {
  const data = await gqlRequest<{ disconnectRepository: boolean }>(DISCONNECT_REPOSITORY_MUTATION, { repositoryId });
  return data.disconnectRepository;
}

export async function syncRepository(repositoryId: string, incremental = true): Promise<SyncJob> {
  const data = await gqlRequest<{ syncRepository: { syncJob: SyncJob } }>(SYNC_REPOSITORY_MUTATION, {
    repositoryId,
    incremental,
  });
  return data.syncRepository.syncJob;
}

export async function syncWorkspace(): Promise<SyncJob[]> {
  const data = await gqlRequest<{ syncWorkspace: Array<{ syncJob: SyncJob }> }>(SYNC_WORKSPACE_MUTATION);
  return data.syncWorkspace.map((s) => s.syncJob);
}

export async function updateProfile(input: { name?: string; email?: string; avatarUrl?: string }): Promise<User> {
  const data = await gqlRequest<{ updateProfile: User }>(UPDATE_PROFILE_MUTATION, { input });
  return data.updateProfile;
}

export async function updateNotificationPreferences(input: { enabled: boolean; types?: NotificationType[] }): Promise<NotificationPreferences> {
  const data = await gqlRequest<{ updateNotificationPreferences: NotificationPreferences }>(
    UPDATE_NOTIFICATION_PREFERENCES_MUTATION,
    { input },
  );
  return data.updateNotificationPreferences;
}

export async function markRecommendationComplete(id: string): Promise<Recommendation> {
  const data = await gqlRequest<{ markRecommendationComplete: Recommendation }>(MARK_RECOMMENDATION_COMPLETE_MUTATION, { id });
  return data.markRecommendationComplete;
}

export async function dismissRecommendation(id: string): Promise<Recommendation> {
  const data = await gqlRequest<{ dismissRecommendation: Recommendation }>(DISMISS_RECOMMENDATION_MUTATION, { id });
  return data.dismissRecommendation;
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const data = await gqlRequest<{ markNotificationRead: Notification }>(MARK_NOTIFICATION_READ_MUTATION, { id });
  return data.markNotificationRead;
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const data = await gqlRequest<{ markAllNotificationsRead: boolean }>(MARK_ALL_NOTIFICATIONS_READ_MUTATION);
  return data.markAllNotificationsRead;
}

export type { GitHubAccount };
