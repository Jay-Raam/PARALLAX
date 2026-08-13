/* Mirror of packages/graphql/src/schema.graphql — used by the typed client layer. */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Severity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type UpdateType = "NONE" | "PATCH" | "MINOR" | "MAJOR";
export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type SyncStatus = "NOT_SYNCED" | "SYNCING" | "SYNCED" | "ERROR";
export type SyncJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
export type PRState = "OPEN" | "CLOSED" | "MERGED";
export type IssueState = "OPEN" | "CLOSED";
export type RecommendationStatus = "ACTIVE" | "COMPLETED" | "DISMISSED";
export type RecommendationType =
  | "DEPENDENCY_UPDATE"
  | "SECURITY_VULNERABILITY"
  | "STALE_ISSUES"
  | "SLOW_REVIEWS"
  | "CI_FAILURES"
  | "DEPLOYMENT_FAILURES"
  | "TESTING_GAPS"
  | "DOCUMENTATION_INACTIVITY"
  | "SECURITY_POSTURE"
  | "DELIVERY_BOTTLENECK";
export type NotificationType =
  | "PR_RISK"
  | "SECURITY_VULNERABILITY"
  | "CI_FAILURE"
  | "DEPLOYMENT_FAILURE"
  | "HEALTH_DROP"
  | "DEPENDENCY_VULNERABILITY"
  | "RECOMMENDATION"
  | "SYNC_COMPLETE";
export type ActivityFilter =
  | "ALL"
  | "COMMITS"
  | "PRS"
  | "ISSUES"
  | "DEPLOYMENTS"
  | "RELEASES"
  | "SECURITY"
  | "REVIEWS"
  | "CI";
export type SecurityCategory =
  | "DEPENDABOT"
  | "SECRET_SCANNING"
  | "CODE_SCANNING"
  | "WORKFLOW_SECURITY"
  | "DEPENDENCY_VULNERABILITIES"
  | "REPOSITORY_PERMISSIONS"
  | "BRANCH_PROTECTION";
export type Range = "_7D" | "_14D" | "_30D" | "_90D";
export type CommitClassification =
  | "feature"
  | "bugfix"
  | "refactor"
  | "docs"
  | "tests"
  | "chore"
  | "dependency";

/* filter enums */
export type RepoHealthFilter = "ALL" | "HEALTHY" | "NEEDS_ATTENTION" | "AT_RISK";
export type RepoActivityFilter = "ALL" | "ACTIVE" | "IDLE" | "NEW";
export type RepoSort = "NAME" | "HEALTH" | "ACTIVITY" | "PRS" | "ISSUES";
export type RepoStatusFilter = "ALL" | "SYNCED" | "SYNCING" | "ERROR";
export type PRStateFilter = "ALL" | "OPEN" | "MERGED" | "CLOSED";
export type IssueStateFilter = "ALL" | "OPEN" | "CLOSED";
export type DependencyFilter = "ALL" | "CRITICAL" | "MAJOR" | "MINOR" | "PATCH" | "SECURITY";
export type SeverityFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type WorkflowStatusFilter = "ALL" | "SUCCESS" | "FAILURE" | "CANCELLED" | "IN_PROGRESS";
export type RiskFilter = "ALL" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AlertStateFilter = "ALL" | "OPEN" | "FIXED" | "DISMISSED";

/* input shapes (mirror GraphQL inputs) */
export interface CommitFilters {
  author?: string;
  classification?: CommitClassification;
  since?: string;
  until?: string;
}
export interface PullRequestFilters {
  state?: PRStateFilter;
  author?: string;
  risk?: RiskFilter;
  label?: string;
}
export interface IssueFilters {
  state?: IssueStateFilter;
  stale?: boolean;
  critical?: boolean;
  label?: string;
}
export interface DependencyFilters {
  update?: DependencyFilter;
  ecosystem?: string;
  search?: string;
}
export interface SecurityFilters {
  severity?: SeverityFilter;
  state?: AlertStateFilter;
  category?: SecurityCategory;
}
export interface WorkflowFilters {
  status?: WorkflowStatusFilter;
  branch?: string;
}
export interface RepositoryFilters {
  search?: string;
  language?: string;
  health?: RepoHealthFilter;
  activity?: RepoActivityFilter;
  status?: RepoStatusFilter;
  sort?: RepoSort;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  githubLogin: string | null;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  user: User;
  role: Role;
  joinedAt: string;
}

export interface WorkspaceSettings {
  defaultBranch: string | null;
  timezone: string | null;
  syncIntervalMinutes: number | null;
  healthThreshold: number | null;
}

export interface WorkspaceStats {
  repositories: number;
  openPrs: number;
  openIssues: number;
  deployments30d: number;
  securityAlerts: number;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: WorkspaceMember[];
  settings: WorkspaceSettings;
  createdAt: string;
  updatedAt: string;
  health: number | null;
  stats: WorkspaceStats | null;
}

export interface GitHubAccount {
  id: string;
  githubLogin: string;
  connectedAt: string;
  lastSyncAt: string | null;
}

export interface Repository {
  id: string;
  workspaceId: string;
  githubId: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  url: string;
  defaultBranch: string;
  isPrivate: boolean;
  language: string | null;
  techStack: string[];
  topics: string[];
  fork: boolean;
  archived: boolean;
  createdAt: string;
  pushedAt: string | null;
  starCount: number;
  forkCount: number;
  openIssuesCount: number;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  source: string;
  enabled: boolean;
  lastActivityAt: string | null;
  health?: RepositoryHealth | null;
  counts?: RepositoryCounts | null;
}

export interface RepositoryCounts {
  commits: number;
  openPrs: number;
  mergedPrs: number;
  openIssues: number;
  closedIssues: number;
  dependencies: number;
  outdatedDependencies: number;
  securityAlerts: number;
  deployments: number;
  releases: number;
  contributors: number;
}

export interface HealthCategory {
  key: string;
  label: string;
  score: number;
  weight: number;
}

export interface HealthTrendPoint {
  date: string;
  score: number;
}

export interface RepositoryHealth {
  repositoryId: string;
  overall: number;
  label: string;
  change: number;
  breakdown: HealthCategory[];
  trend: HealthTrendPoint[];
  explanations: string[];
  risks: string[];
  computedAt: string;
}

export interface Branch {
  id: string;
  name: string;
  headSha: string;
  isDefault: boolean;
  lastCommitAt: string | null;
}

export interface Commit {
  id: string;
  repositoryId: string;
  sha: string;
  authorLogin: string;
  authorName: string;
  message: string;
  messageTitle: string;
  date: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  isMerge: boolean;
  classification: CommitClassification;
  repository?: Repository | null;
}

export interface PullRequestReview {
  id: string;
  reviewerLogin: string;
  state: string;
  submittedAt: string | null;
  body: string | null;
}

export interface PRLifecycle {
  stage: string;
  at: string | null;
}

export interface PRRisk {
  score: number;
  level: RiskLevel;
  factors: string[];
  explanation: string;
}

export interface PullRequest {
  id: string;
  repositoryId: string;
  githubNumber: number;
  title: string;
  body: string | null;
  state: PRState;
  authorLogin: string;
  createdAt: string;
  updatedAt: string | null;
  closedAt: string | null;
  mergedAt: string | null;
  baseRef: string;
  headRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  isDraft: boolean;
  labels: string[];
  reviewDecision: string | null;
  risk: PRRisk | null;
  reviewTimeMs: number | null;
  approvalTimeMs: number | null;
  mergeTimeMs: number | null;
  deployTimeMs: number | null;
  testFilesChanged: number;
  dependenciesChanged: number;
  authFilesChanged: number;
  migrationFilesChanged: number;
  files: string[];
  lifecycle: PRLifecycle[];
  reviews: PullRequestReview[];
  repository?: Repository | null;
}

export interface Issue {
  id: string;
  repositoryId: string;
  githubNumber: number;
  title: string;
  body: string | null;
  state: IssueState;
  authorLogin: string;
  createdAt: string;
  updatedAt: string | null;
  closedAt: string | null;
  labels: string[];
  assignees: string[];
  commentsCount: number;
  daysInactive: number;
  isStale: boolean;
  isCritical: boolean;
  repository?: Repository | null;
}

export interface DependencyVulnerability {
  severity: Severity;
  advisory: string | null;
}

export interface Dependency {
  id: string;
  repositoryId: string;
  name: string;
  ecosystem: string;
  currentVersion: string;
  latestVersion: string | null;
  updateType: UpdateType;
  risk: RiskLevel;
  vulnerabilities: DependencyVulnerability[];
  isDirect: boolean;
  outdated: boolean;
  packageManager: string | null;
  repository?: Repository | null;
}

export interface SecurityAlert {
  id: string;
  repositoryId: string;
  type: SecurityCategory;
  severity: Severity;
  title: string;
  description: string | null;
  state: string;
  createdAt: string;
  url: string | null;
  packageName: string | null;
  repository?: Repository | null;
}

export interface Workflow {
  id: string;
  repositoryId: string;
  name: string;
  path: string;
  state: string;
}

export interface WorkflowStep {
  name: string;
  status: string;
  conclusion: string | null;
  durationMs: number | null;
}

export interface WorkflowRun {
  id: string;
  repositoryId: string;
  workflowId: string;
  workflowName: string;
  runNumber: number;
  event: string;
  status: string;
  headSha: string;
  branch: string;
  createdAt: string;
  updatedAt: string | null;
  durationMs: number | null;
  steps: WorkflowStep[];
  repository?: Repository | null;
}

export interface Deployment {
  id: string;
  repositoryId: string;
  environment: string;
  ref: string;
  sha: string;
  creatorLogin: string;
  status: string;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
  version: string | null;
  repository?: Repository | null;
}

export interface ReleaseHealth {
  score: number;
  label: string;
  features: number;
  bugFixes: number;
  breakingChanges: number;
  dependencyChanges: number;
  commitCount: number;
  explanation: string;
}

export interface Release {
  id: string;
  repositoryId: string;
  tagName: string;
  name: string | null;
  publishedAt: string;
  authorLogin: string;
  isPrerelease: boolean;
  body: string | null;
  commitSha: string | null;
  commitCount: number;
  features: string[];
  bugFixes: string[];
  breakingChanges: string[];
  dependencyChanges: string[];
  health: ReleaseHealth | null;
  repository?: Repository | null;
}

export interface Contributor {
  id: string;
  repositoryId: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
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
  repository?: Repository | null;
}

export interface SyncProgress {
  phase: string;
  current: number;
  total: number;
  percent: number;
}

export interface SyncJob {
  id: string;
  workspaceId: string;
  repositoryId: string;
  type: string;
  status: SyncJobStatus;
  progress: SyncProgress;
  stats: Record<string, unknown>;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  triggeredBy: string;
}

export interface MetricPoint {
  date: string;
  commits: number;
  pullRequests: number;
  mergedPrs: number;
  issuesOpened: number;
  issuesClosed: number;
  deployments: number;
  releases: number;
  buildSuccessRate: number | null;
  avgBuildTimeMs: number | null;
}

export interface CommitClassificationCount {
  classification: CommitClassification;
  count: number;
}

export interface ContributorActivity {
  login: string;
  commits: number;
  additions: number;
  deletions: number;
}

export interface RiskBucket {
  level: RiskLevel;
  count: number;
}

export interface DependencyBucket {
  updateType: UpdateType;
  count: number;
}

export interface SeverityBucket {
  severity: Severity;
  count: number;
}

export interface SecurityCategoryBucket {
  category: SecurityCategory;
  count: number;
}

export interface PipelineStageStat {
  name: string;
  status: string;
  averageMs: number;
  count: number;
}

export interface DeploymentBucket {
  environment: string;
  count: number;
}

export interface ActivityItem {
  id: string;
  at: string;
  type: ActivityFilter;
  repositoryId: string | null;
  repositoryName: string | null;
  title: string;
  subtitle: string | null;
  meta: Record<string, unknown> | null;
}

export interface Recommendation {
  id: string;
  workspaceId: string;
  repositoryId: string | null;
  type: RecommendationType;
  priority: Priority;
  title: string;
  reason: string;
  evidence: Record<string, unknown>;
  impact: string;
  suggestedAction: string;
  status: RecommendationStatus;
  createdAt: string;
  updatedAt: string;
  repository?: Repository | null;
}

export interface Notification {
  id: string;
  workspaceId: string;
  userId: string | null;
  type: NotificationType;
  severity: Severity;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  url: string | null;
}

export interface NotificationPreferences {
  enabled: boolean;
  types: NotificationType[];
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  actorId: string;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface AuthPayload {
  user: User;
  workspace: Workspace;
}

export interface AvailableRepository {
  githubId: number;
  name: string;
  fullName: string;
  language: string | null;
  description: string | null;
  isPrivate: boolean;
  connected: boolean;
}

export interface SearchResults {
  repositories: Repository[];
  pullRequests: PullRequest[];
  issues: Issue[];
  commits: Commit[];
  dependencies: Dependency[];
  deployments: Deployment[];
  contributors: Contributor[];
  recommendations: Recommendation[];
}

/* Analytics result types */

export interface CommitAnalytics {
  today: number;
  thisWeek: number;
  thisMonth: number;
  activity: MetricPoint[];
  classification: CommitClassificationCount[];
  contributors: ContributorActivity[];
  weeklyDistribution: MetricPoint[];
}

export interface PRAnalytics {
  openCount: number;
  mergedCount: number;
  averageCycleTimeMs: number;
  averageReviewTimeMs: number;
  averageMergeTimeMs: number;
  mergeRate: number;
  cycleTimeSeries: MetricPoint[];
  riskDistribution: RiskBucket[];
}

export interface IssueAnalytics {
  open: number;
  closed: number;
  stale: number;
  critical: number;
  averageAgeDays: number;
  averageResolutionDays: number;
  resolutionSeries: MetricPoint[];
}

export interface DependencyAnalytics {
  total: number;
  outdated: number;
  vulnerable: number;
  critical: number;
  byUpdateType: DependencyBucket[];
  bySeverity: SeverityBucket[];
  topOutdated: Dependency[];
}

export interface SecurityAnalytics {
  score: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  fixed: number;
  byCategory: SecurityCategoryBucket[];
  recent: SecurityAlert[];
}

export interface CICDAnalytics {
  buildSuccessRate: number;
  averageBuildTimeMs: number;
  failedRuns: number;
  successfulRuns: number;
  totalRuns: number;
  deployments: number;
  successSeries: MetricPoint[];
  pipelineStages: PipelineStageStat[];
}

export interface DeploymentAnalytics {
  total: number;
  successful: number;
  failed: number;
  byEnvironment: DeploymentBucket[];
  series: MetricPoint[];
  averageTimeToDeployMs: number;
}

export interface ReleaseAnalytics {
  total: number;
  prereleases: number;
  averageCommits: number;
  series: MetricPoint[];
  latest: Release[];
}

export interface ContributorAnalytics {
  total: number;
  active30d: number;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  commitsByAuthor: ContributorActivity[];
  activitySeries: MetricPoint[];
  busFactor: number;
}

export interface DeliveryFunnelStage {
  stage: string;
  from: string;
  to: string;
  averageMs: number;
  count: number;
  changePct: number | null;
  isBottleneck: boolean;
}

export interface DeliveryFunnel {
  stages: DeliveryFunnelStage[];
  bottleneck: DeliveryFunnelStage | null;
  currentCycleTimeMs: number;
  previousCycleTimeMs: number;
  cycleTimeChangePct: number;
}

export interface RepositoryComparisonItem {
  repositoryId: string;
  name: string;
  health: number;
  commits: number;
  pullRequests: number;
  cycleTimeMs: number;
  buildSuccessRate: number;
  contributors: number;
  openIssues: number;
  staleIssues: number;
}

export interface EngineeringOverview {
  health: number;
  healthChange: number;
  repositories: number;
  openPrs: number;
  openIssues: number;
  deployments: number;
  securityAlerts: number;
  commits30d: number;
  topRisks: string[];
  bottleneck: string | null;
  recommendations: Recommendation[];
  healthTrend: HealthTrendPoint[];
  activity: ActivityConnection;
  recentDeployments: Deployment[];
}

export interface ActivityConnection {
  edges: Array<{ node: ActivityItem; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface RepositoryConnection {
  edges: Array<{ node: Repository; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface CommitConnection {
  edges: Array<{ node: Commit; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface PullRequestConnection {
  edges: Array<{ node: PullRequest; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface IssueConnection {
  edges: Array<{ node: Issue; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface DependencyConnection {
  edges: Array<{ node: Dependency; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface SecurityAlertConnection {
  edges: Array<{ node: SecurityAlert; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface WorkflowRunConnection {
  edges: Array<{ node: WorkflowRun; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface DeploymentConnection {
  edges: Array<{ node: Deployment; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface ReleaseConnection {
  edges: Array<{ node: Release; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface ContributorConnection {
  edges: Array<{ node: Contributor; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface RecommendationConnection {
  edges: Array<{ node: Recommendation; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface NotificationConnection {
  edges: Array<{ node: Notification; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface AuditLogConnection {
  edges: Array<{ node: AuditLog; cursor: string }>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface ConnectGitHubPayload {
  githubAccount: GitHubAccount;
  repositories: RepositoryConnection;
}
