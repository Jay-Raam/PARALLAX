import type {
  DeploymentStatus,
  PRState,
  RiskLevel,
  SecurityCategory,
  Severity,
  UpdateType,
  WorkflowRunStatus,
} from "@parallax/shared";

/**
 * Normalized DTOs produced by GitHub clients (real or mock) and consumed by
 * the sync service. The frontend never sees raw GitHub API shapes.
 */

export interface GitHubRepositoryDTO {
  githubId: number;
  name: string;
  fullName: string;
  owner: string;
  description?: string;
  url: string;
  defaultBranch: string;
  isPrivate: boolean;
  language?: string;
  techStack: string[];
  topics: string[];
  fork: boolean;
  archived: boolean;
  createdAt: string;
  pushedAt?: string;
  starCount: number;
  forkCount: number;
  openIssuesCount: number;
}

export interface GitHubBranchDTO {
  name: string;
  headSha: string;
  isDefault: boolean;
  lastCommitAt?: string;
}

export interface GitHubCommitDTO {
  sha: string;
  authorLogin: string;
  authorName: string;
  authorEmail?: string;
  message: string;
  date: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  isMerge: boolean;
  classification: "feature" | "bugfix" | "refactor" | "docs" | "tests" | "chore" | "dependency";
}

export interface GitHubReviewDTO {
  reviewerLogin: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING" | "DISMISSED";
  submittedAt?: string;
  body?: string;
}

export interface GitHubPullRequestDTO {
  githubNumber: number;
  title: string;
  body?: string;
  state: PRState;
  authorLogin: string;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  mergedAt?: string;
  mergedBy?: string;
  baseRef: string;
  headRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  isDraft: boolean;
  labels: string[];
  reviewDecision?: string;
  files: string[];
  reviews: GitHubReviewDTO[];
  deployAt?: string;
}

export interface GitHubIssueDTO {
  githubNumber: number;
  title: string;
  body?: string;
  state: "OPEN" | "CLOSED";
  authorLogin: string;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  labels: string[];
  assignees: string[];
  commentsCount: number;
}

export interface GitHubDependencyDTO {
  name: string;
  ecosystem: string;
  currentVersion: string;
  latestVersion?: string;
  updateType: UpdateType;
  risk: RiskLevel;
  vulnerabilities: { severity: Severity; advisory?: string }[];
  isDirect: boolean;
  outdated: boolean;
  packageManager?: string;
}

export interface GitHubSecurityAlertDTO {
  githubId?: number;
  type: SecurityCategory;
  severity: Severity;
  title: string;
  description?: string;
  state: "OPEN" | "FIXED" | "DISMISSED";
  createdAt: string;
  url?: string;
  packageName?: string;
}

export interface GitHubWorkflowDTO {
  name: string;
  path: string;
  state: string;
}

export interface GitHubWorkflowRunDTO {
  workflowName: string;
  workflowPath: string;
  runNumber: number;
  event: string;
  status: WorkflowRunStatus;
  headSha: string;
  branch: string;
  createdAt: string;
  durationMs?: number;
  steps: { name: string; status: string; conclusion?: string; durationMs?: number }[];
}

export interface GitHubDeploymentDTO {
  environment: string;
  ref: string;
  sha: string;
  creatorLogin: string;
  status: DeploymentStatus;
  description?: string;
  createdAt: string;
  version?: string;
}

export interface GitHubReleaseDTO {
  tagName: string;
  name?: string;
  publishedAt: string;
  authorLogin: string;
  isPrerelease: boolean;
  body?: string;
  commitSha?: string;
  commitCount: number;
  features: string[];
  bugFixes: string[];
  breakingChanges: string[];
  dependencyChanges: string[];
}

export interface GitHubContributorDTO {
  login: string;
  name?: string;
  avatarUrl?: string;
  role: string;
  commits: number;
  additions: number;
  deletions: number;
  pullRequestsCreated: number;
  reviewsGiven: number;
  issuesOpened: number;
  issuesClosed: number;
  firstContributionAt: string;
  lastContributionAt: string;
}

export interface GitHubClient {
  readonly mode: "github" | "mock";
  /** Repositories the connected account can access. */
  listRepositories(): Promise<GitHubRepositoryDTO[]>;
  getRepository(fullName: string): Promise<GitHubRepositoryDTO | null>;
  listBranches(repo: GitHubRepositoryDTO): Promise<GitHubBranchDTO[]>;
  /**
   * Commits after `since` (incremental). When `since` is null, returns the
   * full history. Implementations cap volume sensibly.
   */
  listCommits(repo: GitHubRepositoryDTO, since?: string): Promise<GitHubCommitDTO[]>;
  listPullRequests(repo: GitHubRepositoryDTO): Promise<GitHubPullRequestDTO[]>;
  listIssues(repo: GitHubRepositoryDTO): Promise<GitHubIssueDTO[]>;
  listDependencies(repo: GitHubRepositoryDTO): Promise<GitHubDependencyDTO[]>;
  listSecurityAlerts(repo: GitHubRepositoryDTO): Promise<GitHubSecurityAlertDTO[]>;
  listWorkflows(repo: GitHubRepositoryDTO): Promise<GitHubWorkflowDTO[]>;
  listWorkflowRuns(repo: GitHubRepositoryDTO): Promise<GitHubWorkflowRunDTO[]>;
  listDeployments(repo: GitHubRepositoryDTO): Promise<GitHubDeploymentDTO[]>;
  listReleases(repo: GitHubRepositoryDTO): Promise<GitHubReleaseDTO[]>;
  listContributors(repo: GitHubRepositoryDTO): Promise<GitHubContributorDTO[]>;
}
