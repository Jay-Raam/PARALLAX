"use client";

import { ShieldAlert, GitPullRequest, GitCommitHorizontal, FileText, Package, AlertTriangle, FlaskConical } from "lucide-react";
import type { PullRequest } from "@/types/graphql";
import { Card, CardHeader } from "@/components/ui/primitives";
import { RiskBadge, PRStateBadge } from "@/components/ui/badges";
import { formatDurationShort, formatInt, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const LIFECYCLE_STAGES = [
  { key: "created", label: "Created" },
  { key: "first_review", label: "First Review" },
  { key: "approved", label: "Approved" },
  { key: "merged", label: "Merged" },
  { key: "deployed", label: "Deployed" },
];

export function PRRiskPanel({ pr }: { pr: PullRequest }) {
  const risk = pr.risk;
  if (!risk) return null;
  const color = risk.level === "CRITICAL" || risk.level === "HIGH" ? "var(--color-danger)" : risk.level === "MEDIUM" ? "var(--color-warning)" : "var(--color-success)";
  return (
    <Card>
      <CardHeader title="Risk analysis" subtitle="Deterministic scoring from the PR risk engine" />
      <div className="flex items-start gap-4 p-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md border" style={{ borderColor: color, color }}>
          <span className="font-mono text-xl font-semibold leading-none">{risk.score}</span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider">/ 100</span>
        </div>
        <div className="min-w-0 flex-1">
          <RiskBadge level={risk.level} />
          <p className="mt-2 text-xs leading-relaxed text-muted">{risk.explanation}</p>
        </div>
      </div>
      <div className="space-y-1.5 border-t border-border p-4 pt-3">
        {risk.factors.map((f) => (
          <p key={f} className="flex items-center gap-2 text-xs text-muted">
            <ShieldAlert className="h-3 w-3 shrink-0 text-warning" /> {f}
          </p>
        ))}
      </div>
    </Card>
  );
}

export function PRMetrics({ pr }: { pr: PullRequest }) {
  const metrics: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: string }> = [
    { icon: FileText, label: "Files changed", value: String(pr.changedFiles) },
    { icon: GitCommitHorizontal, label: "Commits", value: String(pr.commits) },
    { icon: GitPullRequest, label: "Lines added", value: `+${formatInt(pr.additions)}`, tone: "text-success" },
    { icon: GitPullRequest, label: "Lines removed", value: `−${formatInt(pr.deletions)}`, tone: "text-danger" },
    { icon: FlaskConical, label: "Test files changed", value: String(pr.testFilesChanged), tone: pr.testFilesChanged === 0 ? "text-warning" : undefined },
    { icon: Package, label: "Dependencies changed", value: String(pr.dependenciesChanged), tone: pr.dependenciesChanged > 0 ? "text-warning" : undefined },
    { icon: AlertTriangle, label: "Auth files changed", value: String(pr.authFilesChanged), tone: pr.authFilesChanged > 0 ? "text-danger" : undefined },
    { icon: AlertTriangle, label: "Migrations", value: String(pr.migrationFilesChanged), tone: pr.migrationFilesChanged > 0 ? "text-danger" : undefined },
  ];
  return (
    <Card>
      <CardHeader title="Change metrics" />
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="bg-surface p-3.5">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-faint">
                <Icon className="h-3 w-3" /> {m.label}
              </p>
              <p className={cn("mt-1.5 font-mono text-lg font-semibold", m.tone ?? "text-foreground")}>{m.value}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function PRLifecycle({ pr }: { pr: PullRequest }) {
  const byStage = new Map(pr.lifecycle.map((l) => [l.stage, l.at]));
  const times: Array<{ label: string; from: string; to: string; ms: number | null }> = [
    { label: "Creation → Review", from: "created", to: "first_review", ms: pr.reviewTimeMs },
    { label: "Review → Approval", from: "first_review", to: "approved", ms: pr.approvalTimeMs },
    { label: "Approval → Merge", from: "approved", to: "merged", ms: pr.mergeTimeMs },
    { label: "Merge → Deploy", from: "merged", to: "deployed", ms: pr.deployTimeMs },
  ];
  return (
    <Card>
      <CardHeader title="Lifecycle" subtitle="Time spent in each delivery stage" />
      <div className="p-4">
        <ol className="relative flex items-start">
          {LIFECYCLE_STAGES.map((stage, i) => {
            const at = byStage.get(stage.key) ?? null;
            const reached = Boolean(at);
            const isLast = i === LIFECYCLE_STAGES.length - 1;
            return (
              <li key={stage.key} className={cn("relative flex-1", !isLast && "")}>
                {!isLast && <span className={cn("absolute left-3 top-3 h-0.5 w-full", reached && byStage.get(LIFECYCLE_STAGES[i + 1]!.key) ? "bg-accent" : "bg-border")} aria-hidden />}
                <div className="relative flex flex-col items-start gap-1.5 pr-2">
                  <span
                    className={cn(
                      "z-10 flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px]",
                      reached ? "border-accent bg-accent-dim text-accent" : "border-border-strong bg-raised text-faint",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className={cn("text-[11px] font-medium", reached ? "text-foreground" : "text-faint")}>{stage.label}</p>
                    <p className="font-mono text-[10px] text-subtle">{at ? formatDateTime(at) : "—"}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 grid gap-x-4 gap-y-2 border-t border-border pt-4 sm:grid-cols-2">
          {times.map((t) => (
            <div key={t.label} className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted">{t.label}</span>
              <span className="font-mono text-[13px] text-foreground">{formatDurationShort(t.ms)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function PRHeader({ pr }: { pr: PullRequest }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-sm text-faint">#{pr.githubNumber}</h1>
        <PRStateBadge state={pr.state} />
        {pr.isDraft && <span className="rounded-xs border border-border bg-raised px-1.5 py-0.5 text-[10px] text-muted">DRAFT</span>}
        {pr.risk && <RiskBadge level={pr.risk.level} score={pr.risk.score} />}
      </div>
      <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">{pr.title}</h2>
      <p className="mt-1 text-xs text-muted">
        <span className="font-mono">{pr.authorLogin}</span> opened {formatDateTime(pr.createdAt)} · {pr.headRef} → {pr.baseRef}
      </p>
    </div>
  );
}
