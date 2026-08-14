"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader } from "@/components/ui/primitives";
import { MetricCard } from "@/components/cards/MetricCard";
import { TrendChart } from "@/components/charts/TrendChart";
import { Donut } from "@/components/charts/Donut";
import { DeliveryFunnelChart } from "@/components/charts/Funnel";
import { ErrorState } from "@/components/ui/feedback";
import {
  fetchCommitAnalytics,
  fetchDeliveryAnalytics,
  fetchIssueAnalytics,
  fetchPullRequestAnalytics,
} from "@/graphql/queries/analytics";
import { formatDurationShort, formatNumber, formatPercent } from "@/lib/utils";

export default function AnalyticsPage() {
  const commits = useQuery({
    queryKey: ["analytics-commits"],
    queryFn: () => fetchCommitAnalytics(undefined, "_30D"),
    placeholderData: (prev) => prev,
  });
  const prs = useQuery({
    queryKey: ["analytics-prs"],
    queryFn: () => fetchPullRequestAnalytics(undefined, "_30D"),
    placeholderData: (prev) => prev,
  });
  const issues = useQuery({
    queryKey: ["analytics-issues"],
    queryFn: () => fetchIssueAnalytics(undefined, "_30D"),
    placeholderData: (prev) => prev,
  });
  const funnel = useQuery({
    queryKey: ["analytics-funnel"],
    queryFn: () => fetchDeliveryAnalytics(undefined, "_30D"),
    placeholderData: (prev) => prev,
  });

  const c = commits.data;
  const p = prs.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        subtitle="Commit velocity, PR cycle time, issue resolution and the delivery funnel."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Commits today" value={c?.today ?? "—"} />
        <MetricCard label="Commits this week" value={c?.thisWeek ?? "—"} />
        <MetricCard label="Commits this month" value={c?.thisMonth ?? "—"} />
        <MetricCard label="Avg cycle time" value={formatDurationShort(p?.averageCycleTimeMs)} />
        <MetricCard label="Avg review time" value={formatDurationShort(p?.averageReviewTimeMs)} />
        <MetricCard label="Merge rate" value={p?.mergeRate !== undefined ? formatPercent(p.mergeRate, 0) : "—"} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Commit activity" subtitle="Commits per day, last 30 days" />
          <div className="p-4">
            <TrendChart
              data={(c?.activity ?? []).map((m) => ({ date: new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), commits: m.commits }))}
              series={[{ key: "commits", name: "Commits", color: "var(--color-accent)" }]}
              height={220}
              formatValue={formatNumber}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Commit classification" subtitle="What the team is working on" />
          <div className="flex justify-center p-4">
            <Donut
              data={(c?.classification ?? []).map((x) => ({ name: x.classification, value: x.count }))}
              centerValue={c?.classification.reduce((s, x) => s + x.count, 0) ?? 0}
              centerLabel="commits"
              size={170}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="PR cycle time" subtitle="Pull requests per day" />
          <div className="p-4">
            <TrendChart
              data={(p?.cycleTimeSeries ?? []).map((m) => ({ date: new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), prs: m.pullRequests }))}
              series={[{ key: "prs", name: "Pull requests", color: "var(--color-violet)" }]}
              height={200}
              formatValue={formatNumber}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Issue resolution" subtitle="Issues closed per day" />
          <div className="p-4">
            <TrendChart
              data={(issues.data?.resolutionSeries ?? []).map((m) => ({ date: new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), closed: m.issuesClosed }))}
              series={[{ key: "closed", name: "Issues closed", color: "var(--color-emerald)" }]}
              height={200}
              formatValue={formatNumber}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Delivery funnel"
          subtitle="Commit → PR → review → approval → merge → CI → deploy → release"
        />
        {funnel.isError ? (
          <ErrorState onRetry={() => void funnel.refetch()} />
        ) : funnel.data ? (
          <DeliveryFunnelChart funnel={funnel.data} />
        ) : (
          <div className="h-64" />
        )}
      </Card>
    </div>
  );
}
