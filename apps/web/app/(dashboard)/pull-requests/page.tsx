"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPullRequestAnalytics } from "@/graphql/queries/analytics";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader } from "@/components/ui/primitives";
import { MetricCard } from "@/components/cards/MetricCard";
import { PullRequestTable } from "@/components/cards/PullRequestTable";
import { Donut } from "@/components/charts/Donut";
import { ErrorState } from "@/components/ui/feedback";
import { formatDurationShort, formatPercent } from "@/lib/utils";

export default function PullRequestsPage() {
  const { data, isError, refetch } = useQuery({
    queryKey: ["pr-analytics"],
    queryFn: () => fetchPullRequestAnalytics(undefined, "_30D"),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Pull Requests" subtitle="Cycle time, review speed and risk across every pull request." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Open" value={data?.openCount ?? "—"} />
        <MetricCard label="Merged (30d)" value={data?.mergedCount ?? "—"} />
        <MetricCard label="Merge rate" value={data?.mergeRate !== undefined ? formatPercent(data.mergeRate, 0) : "—"} />
        <MetricCard label="Cycle time" value={formatDurationShort(data?.averageCycleTimeMs)} />
        <MetricCard label="First review" value={formatDurationShort(data?.averageReviewTimeMs)} />
        <MetricCard label="Approval → merge" value={formatDurationShort(data?.averageMergeTimeMs)} />
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}

      <div className="grid gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader title="Risk distribution" subtitle="Merged + open PRs by risk level" />
          <div className="flex justify-center p-4">
            <Donut
              data={(data?.riskDistribution ?? []).map((r) => ({ name: r.level, value: r.count }))}
              centerValue={data?.riskDistribution.reduce((s, r) => s + r.count, 0) ?? 0}
              centerLabel="PRs"
              size={170}
            />
          </div>
        </Card>
        <div className="xl:col-span-2">
          <PullRequestTable />
        </div>
      </div>
    </div>
  );
}
