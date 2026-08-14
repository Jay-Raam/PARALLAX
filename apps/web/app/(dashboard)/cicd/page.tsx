"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCicdAnalytics, fetchDeploymentAnalytics } from "@/graphql/queries/analytics";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader } from "@/components/ui/primitives";
import { MetricCard } from "@/components/cards/MetricCard";
import { TrendChart, LineTrendChart, formatMsTicks } from "@/components/charts/TrendChart";
import { WorkflowTable } from "@/components/cards/WorkflowTable";
import { DeploymentTimeline } from "@/components/cards/DeploymentTimeline";
import { HBarList } from "@/components/charts/Bars";
import { ErrorState } from "@/components/ui/feedback";
import { formatDurationShort, formatPercent } from "@/lib/utils";

export default function CicdPage() {
  const { data: cicd, isError, refetch } = useQuery({
    queryKey: ["cicd-analytics"],
    queryFn: () => fetchCicdAnalytics(undefined, "_30D"),
    placeholderData: (prev) => prev,
  });

  const { data: deploys } = useQuery({
    queryKey: ["deployment-analytics"],
    queryFn: () => fetchDeploymentAnalytics(undefined, "_30D"),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="CI/CD" subtitle="Build success, pipeline health and deployment frequency." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Build success"
          value={cicd?.buildSuccessRate !== undefined ? formatPercent(cicd.buildSuccessRate, 0) : "—"}
          tone={(cicd?.buildSuccessRate ?? 1) >= 0.9 ? "success" : (cicd?.buildSuccessRate ?? 1) >= 0.75 ? "warning" : "danger"}
        />
        <MetricCard label="Avg build time" value={formatDurationShort(cicd?.averageBuildTimeMs)} />
        <MetricCard label="Failed runs" value={cicd?.failedRuns ?? "—"} tone={(cicd?.failedRuns ?? 0) > 0 ? "danger" : "default"} />
        <MetricCard label="Total runs" value={cicd?.totalRuns ?? "—"} />
        <MetricCard label="Deployments" value={cicd?.deployments ?? "—"} />
        <MetricCard label="Time to deploy" value={formatDurationShort(deploys?.averageTimeToDeployMs)} />
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Build success rate" subtitle="Last 30 days" />
          <div className="p-4">
            <LineTrendChart
              data={(cicd?.successSeries ?? []).map((p) => ({ date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), success: p.buildSuccessRate != null ? Math.round(p.buildSuccessRate * 100) : 0 }))}
              series={[{ key: "success", name: "Success %", color: "var(--color-success)" }]}
              height={210}
              yTickFormatter={(v) => `${v}%`}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Average build time" subtitle="Last 30 days" />
          <div className="p-4">
            <TrendChart
              data={(cicd?.successSeries ?? []).map((p) => ({ date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), ms: p.avgBuildTimeMs ?? 0 }))}
              series={[{ key: "ms", name: "Build time", color: "var(--color-amber)" }]}
              height={210}
              yTickFormatter={(v) => formatMsTicks(v)}
              formatValue={(v) => formatDurationShort(v)}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader title="Pipeline stages" subtitle="Average duration per stage" />
          <div className="p-4">
            <HBarList
              items={(cicd?.pipelineStages ?? []).map((s) => ({
                label: s.name,
                value: Math.round(s.averageMs / 1000),
                color: s.status === "FAILURE" ? "var(--color-danger)" : "var(--color-accent)",
              }))}
              formatValue={(v) => formatDurationShort(v * 1000)}
            />
          </div>
        </Card>
        <div className="xl:col-span-2">
          <WorkflowTable />
        </div>
      </div>

      <DeploymentTimeline limit={8} />
    </div>
  );
}
