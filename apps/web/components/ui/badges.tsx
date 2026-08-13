"use client";

import { Badge, type BadgeTone } from "./primitives";
import { cn } from "@/lib/utils";
import type { Priority, RiskLevel, Severity } from "@/types/graphql";

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number | null }) {
  const tone: BadgeTone = level === "CRITICAL" ? "danger" : level === "HIGH" ? "danger" : level === "MEDIUM" ? "warning" : "success";
  return (
    <Badge tone={tone} className="font-mono">
      {score !== null && score !== undefined ? `${score} · ` : ""}
      {level}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone: BadgeTone =
    severity === "CRITICAL" ? "danger" : severity === "HIGH" ? "danger" : severity === "MEDIUM" ? "warning" : severity === "LOW" ? "info" : "muted";
  return <Badge tone={tone}>{severity}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const tone: BadgeTone = priority === "CRITICAL" || priority === "HIGH" ? "danger" : priority === "MEDIUM" ? "warning" : "info";
  return <Badge tone={tone}>{priority}</Badge>;
}

export function HealthBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <Badge tone="muted">—</Badge>;
  const tone: BadgeTone = score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
  return <Badge tone={tone} className="font-mono">{score}</Badge>;
}

export function SyncStatusBadge({ status }: { status: string }) {
  const tone: BadgeTone =
    status === "SYNCED" ? "success" : status === "SYNCING" ? "accent" : status === "ERROR" ? "danger" : "muted";
  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>;
}

export function WorkflowStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone: BadgeTone = s === "success" || s === "completed" ? "success" : s === "failure" || s === "failed" || s === "action_required" ? "danger" : s === "in_progress" || s === "queued" ? "accent" : s === "cancelled" || s === "skipped" || s === "stale" || s === "neutral" ? "muted" : "default";
  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>;
}

export function DeploymentStatusBadge({ status }: { status: string }) {
  const tone: BadgeTone = status === "SUCCESS" ? "success" : status === "FAILURE" ? "danger" : status === "PENDING" ? "accent" : "muted";
  return <Badge tone={tone}>{status}</Badge>;
}

export function PRStateBadge({ state }: { state: string }) {
  const tone: BadgeTone = state === "OPEN" ? "success" : state === "MERGED" ? "accent" : "muted";
  return <Badge tone={tone}>{state}</Badge>;
}

export function IssueStateBadge({ state, stale, critical }: { state: string; stale?: boolean; critical?: boolean }) {
  if (critical) return <Badge tone="danger">CRITICAL</Badge>;
  if (stale) return <Badge tone="warning">STALE</Badge>;
  const tone: BadgeTone = state === "OPEN" ? "success" : "muted";
  return <Badge tone={tone}>{state}</Badge>;
}

export function UpdateTypeBadge({ updateType }: { updateType: string }) {
  const tone: BadgeTone = updateType === "MAJOR" ? "danger" : updateType === "MINOR" ? "warning" : updateType === "PATCH" ? "info" : "muted";
  return <Badge tone={tone}>{updateType}</Badge>;
}

export function ClassificationBadge({ classification }: { classification: string }) {
  const map: Record<string, BadgeTone> = {
    feature: "accent",
    bugfix: "danger",
    refactor: "info",
    docs: "muted",
    tests: "success",
    chore: "default",
    dependency: "warning",
  };
  return <Badge tone={map[classification] ?? "muted"} className="font-mono lowercase">{classification}</Badge>;
}

export function Dot({ tone, className }: { tone: BadgeTone; className?: string }) {
  const colors: Record<BadgeTone, string> = {
    default: "bg-faint",
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
    muted: "bg-border-strong",
  };
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", colors[tone], className)} aria-hidden />;
}
