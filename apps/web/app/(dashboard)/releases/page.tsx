"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchReleaseAnalytics } from "@/graphql/queries/analytics";
import { fetchReleases } from "@/graphql/queries/supply";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader, Button } from "@/components/ui/primitives";
import { MetricCard } from "@/components/cards/MetricCard";
import { ReleaseCard } from "@/components/cards/ReleaseCard";
import { Bars } from "@/components/charts/Bars";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/utils";

export default function ReleasesPage() {
  const { data: analytics, isError, refetch } = useQuery({
    queryKey: ["release-analytics"],
    queryFn: () => fetchReleaseAnalytics(undefined, "_90D"),
    placeholderData: (prev) => prev,
  });

  const { data: releases, isPending } = useQuery({
    queryKey: ["releases", "all"],
    queryFn: () => fetchReleases(undefined, { first: 30 }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Releases" subtitle="Release intelligence — what shipped, and how healthy it was." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Releases (90d)" value={analytics?.total ?? "—"} />
        <MetricCard label="Prereleases" value={analytics?.prereleases ?? "—"} tone={(analytics?.prereleases ?? 0) > 0 ? "warning" : "default"} />
        <MetricCard label="Avg commits / release" value={analytics?.averageCommits != null ? analytics.averageCommits.toFixed(1) : "—"} />
        <MetricCard label="Releases with health data" value={analytics?.latest.filter((r) => r.health?.score != null).length ?? "—"} />
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}

      <Card>
        <CardHeader title="Release frequency" subtitle="Releases per week over the last 90 days" />
        <div className="p-4">
          <Bars
            data={(analytics?.series ?? []).map((p) => ({ name: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), Releases: p.releases }))}
            dataKey="Releases"
            name="Releases"
            height={200}
            formatValue={formatNumber}
          />
        </div>
      </Card>

      {isPending ? (
        <Card>
          <LoadingRows rows={5} columns={3} />
        </Card>
      ) : (
        <div className="space-y-3">
          {(releases?.edges ?? []).map((e) => (
            <ReleaseCard key={e.node.id} release={e.node} />
          ))}
          {releases?.pageInfo.hasNextPage && (
            <div className="text-center">
              <Button variant="ghost" size="sm">Load more</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
