import { z } from "zod";

/* ───────────────────────────────────────────────────────────
 * Enums / string unions
 * ─────────────────────────────────────────────────────────── */

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const UPDATE_TYPES = ["NONE", "PATCH", "MINOR", "MAJOR"] as const;
export type UpdateType = (typeof UPDATE_TYPES)[number];

export const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const SYNC_STATUSES = ["NOT_SYNCED", "SYNCING", "SYNCED", "ERROR"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SYNC_JOB_STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"] as const;
export type SyncJobStatus = (typeof SYNC_JOB_STATUSES)[number];

export const PR_STATES = ["OPEN", "CLOSED", "MERGED"] as const;
export type PRState = (typeof PR_STATES)[number];

export const ISSUE_STATES = ["OPEN", "CLOSED"] as const;
export type IssueState = (typeof ISSUE_STATES)[number];

export const WORKFLOW_RUN_STATUSES = [
  "QUEUED",
  "IN_PROGRESS",
  "COMPLETED",
  "ACTION_REQUIRED",
  "CANCELLED",
  "FAILURE",
  "NEUTRAL",
  "SKIPPED",
  "STALE",
  "SUCCESS",
] as const;
export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number];

export const DEPLOYMENT_STATUSES = ["PENDING", "SUCCESS", "FAILURE", "INACTIVE"] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "PR_RISK",
  "SECURITY_VULNERABILITY",
  "CI_FAILURE",
  "DEPLOYMENT_FAILURE",
  "HEALTH_DROP",
  "DEPENDENCY_VULNERABILITY",
  "RECOMMENDATION",
  "SYNC_COMPLETE",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const RECOMMENDATION_TYPES = [
  "DEPENDENCY_UPDATE",
  "SECURITY_VULNERABILITY",
  "STALE_ISSUES",
  "SLOW_REVIEWS",
  "CI_FAILURES",
  "DEPLOYMENT_FAILURES",
  "TESTING_GAPS",
  "DOCUMENTATION_INACTIVITY",
  "SECURITY_POSTURE",
  "DELIVERY_BOTTLENECK",
] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_STATUSES = ["ACTIVE", "COMPLETED", "DISMISSED"] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "GITHUB_CONNECTED",
  "GITHUB_DISCONNECTED",
  "REPOSITORY_CONNECTED",
  "REPOSITORY_DISCONNECTED",
  "REPOSITORY_SYNCED",
  "WORKSPACE_CREATED",
  "WORKSPACE_UPDATED",
  "MEMBER_ADDED",
  "MEMBER_REMOVED",
  "ROLE_CHANGED",
  "SETTINGS_UPDATED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ACTIVITY_FILTERS = [
  "ALL",
  "COMMITS",
  "PRS",
  "ISSUES",
  "DEPLOYMENTS",
  "RELEASES",
  "SECURITY",
  "REVIEWS",
  "CI",
] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

export const RANGES = ["7D", "14D", "30D", "90D"] as const;
export type Range = (typeof RANGES)[number];

export const SECURITY_CATEGORIES = [
  "DEPENDABOT",
  "SECRET_SCANNING",
  "CODE_SCANNING",
  "WORKFLOW_SECURITY",
  "DEPENDENCY_VULNERABILITIES",
  "REPOSITORY_PERMISSIONS",
  "BRANCH_PROTECTION",
] as const;
export type SecurityCategory = (typeof SECURITY_CATEGORIES)[number];

export const COMMIT_CLASSIFICATIONS = [
  "feature",
  "bugfix",
  "refactor",
  "docs",
  "tests",
  "chore",
  "dependency",
] as const;
export type CommitClassification = (typeof COMMIT_CLASSIFICATIONS)[number];

/* ───────────────────────────────────────────────────────────
 * Health engine weights (must sum to 100)
 * ─────────────────────────────────────────────────────────── */

export const HEALTH_WEIGHTS = {
  codeQuality: 20,
  testing: 15,
  dependencies: 15,
  security: 15,
  documentation: 5,
  cicd: 10,
  activity: 5,
  issueHygiene: 10,
  releaseStability: 5,
} as const;

export const HEALTH_CATEGORIES = Object.keys(HEALTH_WEIGHTS) as HealthCategory[];
export type HealthCategory = keyof typeof HEALTH_WEIGHTS;

export const HEALTH_LABELS: Record<HealthCategory, string> = {
  codeQuality: "Code Quality",
  testing: "Testing",
  dependencies: "Dependencies",
  security: "Security",
  documentation: "Documentation",
  cicd: "CI/CD",
  activity: "Activity",
  issueHygiene: "Issue Hygiene",
  releaseStability: "Release Stability",
};

export function riskLevelForScore(score: number): RiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

export function healthLabel(score: number): "EXCELLENT" | "HEALTHY" | "NEEDS ATTENTION" | "AT RISK" {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "HEALTHY";
  if (score >= 50) return "NEEDS ATTENTION";
  return "AT RISK";
}

/* ───────────────────────────────────────────────────────────
 * Zod schemas shared between API validators and web forms
 * ─────────────────────────────────────────────────────────── */

export const paginationSchema = z.object({
  first: z.number().int().min(1).max(100).optional(),
  after: z.string().optional(),
  last: z.number().int().min(1).max(100).optional(),
  before: z.string().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers and dashes")
    .max(64)
    .optional(),
  settings: z
    .object({
      defaultBranch: z.string().max(120).optional(),
      timezone: z.string().max(64).optional(),
      syncIntervalMinutes: z.number().int().min(15).max(1440).optional(),
      healthThreshold: z.number().int().min(0).max(100).optional(),
    })
    .optional(),
});

export const notificationPreferenceSchema = z.object({
  enabled: z.boolean().optional(),
  types: z.array(z.enum(NOTIFICATION_TYPES)).optional(),
});

export const repositoryFiltersSchema = z.object({
  search: z.string().max(120).optional(),
  language: z.string().max(64).optional(),
  health: z.enum(["ALL", "HEALTHY", "NEEDS_ATTENTION", "AT_RISK"]).optional(),
  activity: z.enum(["ALL", "ACTIVE", "IDLE", "NEW"]).optional(),
  status: z.enum(["ALL", "SYNCED", "SYNCING", "ERROR"]).optional(),
  sort: z.enum(["NAME", "HEALTH", "ACTIVITY", "PRS", "ISSUES"]).optional(),
});

export const commitFiltersSchema = z.object({
  author: z.string().max(120).optional(),
  classification: z.enum(COMMIT_CLASSIFICATIONS).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
});

export const prFiltersSchema = z.object({
  state: z.enum(["ALL", "OPEN", "MERGED", "CLOSED"]).optional(),
  author: z.string().max(120).optional(),
  risk: z.enum(["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  label: z.string().max(120).optional(),
});

export const issueFiltersSchema = z.object({
  state: z.enum(["ALL", "OPEN", "CLOSED"]).optional(),
  stale: z.boolean().optional(),
  critical: z.boolean().optional(),
  label: z.string().max(120).optional(),
});

export const dependencyFiltersSchema = z.object({
  update: z.enum(["ALL", "CRITICAL", "MAJOR", "MINOR", "PATCH", "SECURITY"]).optional(),
  ecosystem: z.string().max(64).optional(),
  search: z.string().max(120).optional(),
});

export const securityFiltersSchema = z.object({
  severity: z.enum(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  state: z.enum(["ALL", "OPEN", "FIXED", "DISMISSED"]).optional(),
  category: z.enum(SECURITY_CATEGORIES).optional(),
});

export const workflowFiltersSchema = z.object({
  status: z.enum(["ALL", "SUCCESS", "FAILURE", "CANCELLED", "IN_PROGRESS"]).optional(),
  branch: z.string().max(120).optional(),
});

export const searchSchema = z.object({
  query: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(20).optional(),
});

/* helpers */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pct(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

export function formatDurationMs(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)}m`;
  if (hours < 48) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round(hours / 24 * 10) / 10}d`;
}

export function daysSince(date: Date | string | number): number {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
}
