"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchContributorAnalytics } from "@/graphql/queries/analytics";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader } from "@/components/ui/primitives";
import { MetricCard } from "@/components/cards/MetricCard";
import { ContributorTable } from "@/components/cards/ContributorTable";
import { TrendChart } from "@/components/charts/TrendChart";
import { HBarList } from "@/components/charts/Bars";
import { ErrorState } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/utils";

export default function ContributorsPage() {
  const { data, isError, refetch } = useQuery({
    queryKey: ["contributor-analytics"],
    queryFn: () => fetchContributorAnalytics(undefined, "_30D"),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contributors"
        subtitle="Engineering distribution and workload — not a leaderboard."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Contributors" value={data?.total ?? "—"} />
        <MetricCard label="Active (30d)" value={data?.active30d ?? "—"} />
        <MetricCard label="Commits" value={formatNumber(data?.totalCommits)} />
        <MetricCard label="Additions" value={formatNumber(data?.totalAdditions)} />
        <MetricCard label="Deletions" value={formatNumber(data?.totalDeletions)} />
        <MetricCard label="Bus factor" value={data?.busFactor ?? "—"} tone={(data?.busFactor ?? 99) <= 2 ? "warning" : "default"} />
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Commit activity" subtitle="Commits per day across the workspace" />
          <div className="p-4">
            <TrendChart
              data={(data?.activitySeries ?? []).map((p) => ({ date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), commits: p.commits }))}
              series={[{ key: "commits", name: "Commits", color: "var(--color-accent)" }]}
              height={200}
              formatValue={formatNumber}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Workload distribution" subtitle="Commits by author — watch for concentration risk" />
          <div className="p-4">
            <HBarList
              items={(data?.commitsByAuthor ?? []).map((c) => ({ label: c.login, value: c.commits }))}
              formatValue={formatNumber}
            />
          </div>
        </Card>
      </div>

      <ContributorTable />
    </div>
  );
}
