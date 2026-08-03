import type {
  AuditAction,
  DeploymentStatus,
  IssueState,
  NotificationType,
  PRState,
  Priority,
  Range,
  RecommendationStatus,
  RecommendationType,
  RiskLevel,
  Role,
  SecurityCategory,
  Severity,
  SyncJobStatus,
  SyncStatus,
  UpdateType,
  WorkflowRunStatus,
} from "@parallax/shared";

export type ObjectId = string;

/* ── Identity & workspace ─────────────────────────────────── */

export interface User {
  id: ObjectId;
  email: string;
  name: string;
  avatarUrl?: string;
  githubLogin?: string;
  createdAt: string;
  lastSeenAt?: string;
}

export interface WorkspaceMember {
  id: ObjectId;
  workspaceId: ObjectId;
  userId: ObjectId;
  role: Role;
  joinedAt: string;
}

export interface Workspace {
  id: ObjectId;
  name: string;
  slug: string;
  ownerId: ObjectId;
  githubOrg?: string;
  settings: {
    defaultBranch?: string;
    timezone?: string;
    syncIntervalMinutes?: number;
    healthThreshold?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GitHubAccount {
  id: ObjectId;
  userId: ObjectId;
  workspaceId?: ObjectId;
  githubLogin: string;
  connectedAt: string;
  lastSyncAt?: string;
}

/* ── Repositories ─────────────────────────────────────────── */

export interface Repository {
  id: ObjectId;
  workspaceId: ObjectId;
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
  syncStatus: SyncStatus;
  lastSyncedAt?: string;
  lastCommitSha?: string;
  enabled: boolean;
  source: "github" | "mock";
}

/* ── Git history ──────────────────────────────────────────── */

export interface Commit {
  id: ObjectId;
  repositoryId: ObjectId;
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
  classification: string;
}

/* ── Pull requests ────────────────────────────────────────── */

export interface PullRequest {
  id: ObjectId;
  repositoryId: ObjectId;
  githubNumber: number;
  title: string;
  body?: string;
  state: PRState;
  authorLogin: string;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  mergedAt?: string;
  baseRef: string;
  headRef: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  isDraft: boolean;
  labels: string[];
  reviewDecision?: string;
  riskScore?: number;
  riskLevel?: RiskLevel;
  riskFactors: string[];
  riskExplanation?: string;
  reviewTimeMs?: number;
  approvalTimeMs?: number;
  mergeTimeMs?: number;
  deployTimeMs?: number;
  testFilesChanged: number;
  dependenciesChanged: number;
  authFilesChanged: number;
  migrationFilesChanged: number;
  files: string[];
  lifecycle?: { stage: string; at?: string }[];
}

/* ── Issues ───────────────────────────────────────────────── */

export interface Issue {
  id: ObjectId;
  repositoryId: ObjectId;
  githubNumber: number;
  title: string;
  body?: string;
  state: IssueState;
  authorLogin: string;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  labels: string[];
  assignees: string[];
  commentsCount: number;
}

/* ── Supply chain & security ──────────────────────────────── */

export interface Dependency {
  id: ObjectId;
  repositoryId: ObjectId;
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

export interface SecurityAlert {
  id: ObjectId;
  repositoryId: ObjectId;
  type: SecurityCategory;
  severity: Severity;
  title: string;
  description?: string;
  state: "OPEN" | "FIXED" | "DISMISSED";
  createdAt: string;
  url?: string;
  packageName?: string;
}

/* ── CI/CD & delivery ─────────────────────────────────────── */

export interface WorkflowRun {
  id: ObjectId;
  repositoryId: ObjectId;
  workflowId: ObjectId;
  workflowName: string;
  runNumber: number;
  event: string;
  status: WorkflowRunStatus;
  headSha: string;
  branch: string;
  createdAt: string;
  updatedAt?: string;
  durationMs?: number;
  steps: { name: string; status: string; conclusion?: string; durationMs?: number }[];
}

export interface Deployment {
  id: ObjectId;
  repositoryId: ObjectId;
  environment: string;
  ref: string;
  sha: string;
  creatorLogin: string;
  status: DeploymentStatus;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  version?: string;
}

export interface Release {
  id: ObjectId;
  repositoryId: ObjectId;
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

export interface Contributor {
  id: ObjectId;
  repositoryId: ObjectId;
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

/* ── Metrics, health, intelligence ────────────────────────── */

export interface HealthScore {
  id: ObjectId;
  repositoryId: ObjectId;
  workspaceId: ObjectId;
  overall: number;
  breakdown: Record<string, number>;
  change?: number;
  explanations: string[];
  risks: string[];
  computedAt: string;
}

export interface Recommendation {
  id: ObjectId;
  workspaceId: ObjectId;
  repositoryId?: ObjectId;
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
}

export interface Notification {
  id: ObjectId;
  workspaceId: ObjectId;
  userId?: ObjectId;
  type: NotificationType;
  severity: Severity;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
  url?: string;
}

export interface SyncJob {
  id: ObjectId;
  workspaceId: ObjectId;
  repositoryId: ObjectId;
  type: "FULL" | "INCREMENTAL";
  status: SyncJobStatus;
  progress: { phase: string; current: number; total: number; percent: number };
  stats: Record<string, number>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  triggeredBy: "WEBHOOK" | "MANUAL" | "SCHEDULE";
}

export interface AuditLog {
  id: ObjectId;
  workspaceId: ObjectId;
  actorId: ObjectId;
  actorName?: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

/* ── Analytics payloads ───────────────────────────────────── */

export interface MetricPoint {
  date: string;
  commits: number;
  pullRequests: number;
  mergedPrs: number;
  issuesOpened: number;
  issuesClosed: number;
  deployments: number;
  releases: number;
  buildSuccessRate?: number;
  avgBuildTimeMs?: number;
}

export interface DeliveryFunnelStage {
  stage: string;
  from: string;
  to: string;
  averageMs: number;
  count: number;
  changePct?: number;
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
  repositoryId: ObjectId;
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

export interface EngineeringActivityItem {
  id: string;
  at: string;
  type: "COMMIT" | "PR" | "REVIEW" | "ISSUE" | "DEPLOYMENT" | "RELEASE" | "SECURITY" | "CI";
  repositoryId?: ObjectId;
  repositoryName?: string;
  title: string;
  subtitle?: string;
  meta?: Record<string, unknown>;
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

export interface SyncProgress {
  repositoryId: ObjectId;
  phase: string;
  current: number;
  total: number;
  percent: number;
  status: SyncJobStatus;
  stats?: Record<string, number>;
}

export type AnalyticsRange = Range;
