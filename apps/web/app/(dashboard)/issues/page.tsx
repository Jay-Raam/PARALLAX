"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchIssueAnalytics } from "@/graphql/queries/analytics";
import { fetchIssues } from "@/graphql/queries/code";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader } from "@/components/ui/primitives";
import { MetricCard } from "@/components/cards/MetricCard";
import { IssueTable } from "@/components/cards/IssueTable";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { formatDurationShort } from "@/lib/utils";
import type { Issue } from "@/types/graphql";

export default function IssuesPage() {
  const { data, isError, refetch } = useQuery({
    queryKey: ["issue-analytics"],
    queryFn: () => fetchIssueAnalytics(undefined, "_30D"),
    placeholderData: (prev) => prev,
  });

  const { data: stale } = useQuery({
    queryKey: ["issues", "stale"],
    queryFn: () => fetchIssues(undefined, { stale: true, state: "OPEN" }, { first: 10 }),
    placeholderData: (prev) => prev,
  });

  const staleIssues = (stale?.edges ?? []).map((e) => e.node);

  return (
    <div className="space-y-5">
      <PageHeader title="Issues" subtitle="Backlog health, stale issues and resolution speed." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Open" value={data?.open ?? "—"} />
        <MetricCard label="Closed (30d)" value={data?.closed ?? "—"} />
        <MetricCard label="Stale" value={data?.stale ?? "—"} tone={(data?.stale ?? 0) > 0 ? "warning" : "default"} />
        <MetricCard label="Critical" value={data?.critical ?? "—"} tone={(data?.critical ?? 0) > 0 ? "danger" : "default"} />
        <MetricCard label="Avg age" value={data?.averageAgeDays ? `${data.averageAgeDays.toFixed(1)}d` : "—"} />
        <MetricCard label="Resolution" value={formatDurationShort((data?.averageResolutionDays ?? 0) * 86_400_000)} />
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}

      <div className="grid gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader title="Stale issue radar" subtitle="Open issues with no activity" />
          {staleIssues.length === 0 ? (
            <EmptyState title="No stale issues" description="Every open issue has recent activity." />
          ) : (
            <div className="divide-y divide-border">
              {staleIssues.map((i: Issue) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: i.daysInactive > 30 ? "var(--color-danger)" : i.daysInactive > 20 ? "var(--color-warning)" : "var(--color-info)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-foreground">
                      <span className="mr-1 font-mono text-[11px] text-faint">#{i.githubNumber}</span>
                      {i.title}
                    </p>
                    <p className="font-mono text-[10px] text-subtle">{i.repository?.name}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[10.5px]" style={{ color: i.daysInactive > 30 ? "var(--color-danger)" : i.daysInactive > 20 ? "var(--color-warning)" : "var(--color-info)" }}>
                    {i.daysInactive}d inactive
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="xl:col-span-2">
          <IssueTable />
        </div>
      </div>
    </div>
  );
}
