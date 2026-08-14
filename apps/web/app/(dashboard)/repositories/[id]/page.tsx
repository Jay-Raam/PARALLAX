"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  GitCommitHorizontal,
  GitPullRequest,
  CircleDot,
  Rocket,
  Star,
  Lock,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { fetchRepository, fetchRepositoryHealth, fetchBranches, fetchSyncJob } from "@/graphql/queries/repositories";
import { fetchReleases } from "@/graphql/queries/supply";
import { fetchActivity } from "@/graphql/queries/activity";
import { syncRepository } from "@/graphql/mutations";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader, Button } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { HealthScore } from "@/components/cards/HealthScore";
import { HealthBreakdown } from "@/components/cards/HealthBreakdown";
import { TrendChart } from "@/components/charts/TrendChart";
import { ActivityTimeline } from "@/components/cards/ActivityTimeline";
import { CommitTable } from "@/components/cards/CommitTable";
import { PullRequestTable } from "@/components/cards/PullRequestTable";
import { IssueTable } from "@/components/cards/IssueTable";
import { DependencyTable } from "@/components/cards/DependencyTable";
import { SecurityAlertTable } from "@/components/cards/SecurityAlertTable";
import { WorkflowTable } from "@/components/cards/WorkflowTable";
import { DeploymentTimeline } from "@/components/cards/DeploymentTimeline";
import { ReleaseCard } from "@/components/cards/ReleaseCard";
import { ContributorTable } from "@/components/cards/ContributorTable";
import { ErrorState, PageLoading } from "@/components/ui/feedback";
import { SyncStatusBadge, HealthBadge } from "@/components/ui/badges";
import { formatInt, formatNumber, timeAgo, cn } from "@/lib/utils";

type Tab =
  | "overview"
  | "activity"
  | "commits"
  | "pullRequests"
  | "issues"
  | "dependencies"
  | "security"
  | "cicd"
  | "deployments"
  | "releases"
  | "contributors"
  | "health";

export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [tab, setTab] = useState<Tab>("overview");

  const { data: repo, isPending, isError, refetch } = useQuery({
    queryKey: ["repository", id],
    queryFn: () => fetchRepository(id),
  });

  const { data: health } = useQuery({
    queryKey: ["repository-health", id],
    queryFn: () => fetchRepositoryHealth(id, "_90D"),
    enabled: tab === "health" || tab === "overview",
    placeholderData: (prev) => prev,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches", id],
    queryFn: () => fetchBranches(id),
    enabled: tab === "overview",
  });

  const { data: activity } = useQuery({
    queryKey: ["activity", "repo", id],
    queryFn: () => fetchActivity(undefined, { first: 12 }),
    enabled: tab === "activity",
  });

  const { data: syncJob } = useQuery({
    queryKey: ["sync-job", id],
    queryFn: () => fetchSyncJob(id),
    refetchInterval: 5000,
    enabled: !!repo,
  });

  const counts = useMemo(() => {
    const c = repo?.counts;
    return [
      { label: "Commits", value: c?.commits ?? 0, icon: GitCommitHorizontal },
      { label: "Open PRs", value: c?.openPrs ?? 0, icon: GitPullRequest },
      { label: "Open issues", value: c?.openIssues ?? 0, icon: CircleDot },
      { label: "Deployments", value: c?.deployments ?? 0, icon: Rocket },
      { label: "Security alerts", value: c?.securityAlerts ?? 0, icon: ShieldAlert },
    ];
  }, [repo]);

  if (isPending) return <PageLoading />;
  if (isError || !repo) {
    return <ErrorState onRetry={() => void refetch()} description="This repository could not be loaded." />;
  }

  const tabs: Array<{ value: Tab; label: string; count?: number }> = [
    { value: "overview", label: "Overview" },
    { value: "activity", label: "Activity" },
    { value: "commits", label: "Commits", count: repo.counts?.commits },
    { value: "pullRequests", label: "Pull Requests", count: repo.counts?.openPrs },
    { value: "issues", label: "Issues", count: repo.counts?.openIssues },
    { value: "dependencies", label: "Dependencies", count: repo.counts?.dependencies },
    { value: "security", label: "Security", count: repo.counts?.securityAlerts },
    { value: "cicd", label: "CI/CD" },
    { value: "deployments", label: "Deployments", count: repo.counts?.deployments },
    { value: "releases", label: "Releases", count: repo.counts?.releases },
    { value: "contributors", label: "Contributors", count: repo.counts?.contributors },
    { value: "health", label: "Health" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex items-center gap-2 font-mono">
            {repo.isPrivate && <Lock className="h-4 w-4 text-subtle" />}
            {repo.name}
            <HealthBadge score={repo.health?.overall} />
            <SyncStatusBadge status={repo.syncStatus} />
          </span>
        }
        subtitle={repo.description ?? `${repo.owner}/${repo.name} · ${repo.fullName}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void syncRepository(id, true)}
            disabled={syncJob?.status === "RUNNING"}
            title={syncJob?.status === "RUNNING" ? "Sync in progress" : "Queue an incremental sync"}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncJob?.status === "RUNNING" && "animate-spin text-accent")} />
            {syncJob?.status === "RUNNING" ? `Syncing ${syncJob.progress.percent}%` : "Sync"}
          </Button>
        }
      />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {counts.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.label} className="p-3.5">
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-faint">
                    <Icon className="h-3 w-3" /> {c.label}
                  </p>
                  <p className="mt-1.5 font-mono text-xl font-semibold">{formatNumber(c.value)}</p>
                </Card>
              );
            })}
            <Card className="p-3.5">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-faint">
                <Star className="h-3 w-3" /> Stars
              </p>
              <p className="mt-1.5 font-mono text-xl font-semibold">{formatInt(repo.starCount)}</p>
            </Card>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <Card>
              <CardHeader title="Health" subtitle="Current engineering health score" />
              <div className="flex justify-center p-5">
                <HealthScore score={repo.health?.overall} change={repo.health?.change} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Tech stack" subtitle="Detected from repository metadata" />
              <div className="flex flex-wrap gap-1.5 p-4">
                {repo.techStack.length > 0 ? (
                  repo.techStack.map((t) => (
                    <span key={t} className="rounded-sm border border-border bg-raised px-2 py-1 font-mono text-[11px] text-muted">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="font-mono text-xs text-subtle">{repo.language ?? "unknown"}</span>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Repository info" />
              <dl className="space-y-2 p-4 text-xs">
                <Row label="Default branch" value={repo.defaultBranch} mono />
                <Row label="Created" value={timeAgo(repo.createdAt)} mono />
                <Row label="Last push" value={timeAgo(repo.pushedAt)} mono />
                <Row label="Forks" value={formatInt(repo.forkCount)} mono />
                <Row label="Visibility" value={repo.isPrivate ? "private" : "public"} />
                <Row label="Source" value={repo.source} mono />
              </dl>
            </Card>
          </div>

          {branches && branches.length > 0 && (
            <Card>
              <CardHeader title="Branches" subtitle={`${branches.length} branches`} />
              <div className="divide-y divide-border">
                {branches.slice(0, 8).map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-4 py-2">
                    <span className="flex items-center gap-2 font-mono text-xs text-foreground">
                      {b.isDefault && <span className="rounded-sm border border-accent/30 bg-accent-dim px-1.5 py-0.5 text-[9px] text-accent">default</span>}
                      {b.name}
                    </span>
                    <span className="font-mono text-[10px] text-faint">{b.headSha.slice(0, 7)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "activity" && (
        <Card>
          <CardHeader title="Activity" subtitle="Recent events for this repository" />
          <ActivityTimeline items={activity?.edges.map((e) => e.node) ?? []} />
        </Card>
      )}

      {tab === "commits" && <CommitTable repositoryId={id} />}
      {tab === "pullRequests" && <PullRequestTable repositoryId={id} />}
      {tab === "issues" && <IssueTable repositoryId={id} />}
      {tab === "dependencies" && <DependencyTable repositoryId={id} />}
      {tab === "security" && <SecurityAlertTable repositoryId={id} />}
      {tab === "cicd" && <WorkflowTable repositoryId={id} />}
      {tab === "deployments" && <DeploymentTimeline repositoryId={id} limit={20} />}
      {tab === "contributors" && <ContributorTable repositoryId={id} />}

      {tab === "releases" && (
        <div className="space-y-3">
          <ReleasesForRepository repositoryId={id} />
        </div>
      )}

      {tab === "health" && health && (
        <div className="grid gap-3 xl:grid-cols-2">
          <Card>
            <CardHeader title="Health breakdown" subtitle="Weighted categories" />
            <div className="p-4">
              <HealthBreakdown breakdown={health.breakdown} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Health trend" subtitle="Last 90 days" />
            <div className="p-4">
              <TrendChart
                data={health.trend.map((p) => ({ date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), score: p.score }))}
                series={[{ key: "score", name: "Health", color: "var(--color-accent)" }]}
                height={220}
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="What changed" subtitle="Explanations from the health engine" />
            <ul className="space-y-1.5 p-4">
              {health.explanations.map((e) => (
                <li key={e} className="flex items-start gap-2 text-xs text-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" /> {e}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Risk factors" subtitle="What's dragging the score down" />
            <ul className="space-y-1.5 p-4">
              {health.risks.map((r) => (
                <li key={r} className="flex items-start gap-2 text-xs text-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warning" /> {r}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("truncate text-foreground", mono && "font-mono text-[11px]")}>{value}</dd>
    </div>
  );
}

function ReleasesForRepository({ repositoryId }: { repositoryId: string }) {
  const { data } = useQuery({
    queryKey: ["releases", repositoryId],
    queryFn: () => fetchReleases(repositoryId, { first: 30 }),
    placeholderData: (prev) => prev,
  });
  const releases = data?.edges.map((e) => e.node) ?? [];
  if (releases.length === 0) {
    return (
      <Card>
        <p className="px-4 py-8 text-center text-xs text-muted">No releases yet.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {releases.map((r) => (
        <ReleaseCard key={r.id} release={r} />
      ))}
    </div>
  );
}
