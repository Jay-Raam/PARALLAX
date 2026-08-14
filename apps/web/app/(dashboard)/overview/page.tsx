"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  FolderGit2,
  GitPullRequest,
  CircleDot,
  Rocket,
  ShieldAlert,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { fetchOverview } from "@/graphql/queries/overview";
import { useSession } from "@/providers/session";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader } from "@/components/ui/primitives";
import { MetricCard } from "@/components/cards/MetricCard";
import { HealthScore, healthLabel } from "@/components/cards/HealthScore";
import { TrendChart } from "@/components/charts/TrendChart";
import { ActivityTimeline } from "@/components/cards/ActivityTimeline";
import { DeploymentTimeline } from "@/components/cards/DeploymentTimeline";
import { PriorityBadge } from "@/components/ui/badges";
import { ErrorState, PageLoading } from "@/components/ui/feedback";
import { formatNumber } from "@/lib/utils";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function OverviewPage() {
  const { user } = useSession();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
    refetchInterval: 60_000,
  });

  if (isPending) return <PageLoading />;
  if (isError || !data) {
    return <ErrorState onRetry={() => void refetch()} description="The engineering overview could not be loaded." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Engineering Overview"
        subtitle={`${greeting()}, ${user?.name?.split(" ")[0] ?? "engineer"}. Here's what happened across your software system.`}
      />

      {/* primary metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Health Score" value={data.health} delta={data.healthChange} deltaLabel="this week" href="/repositories" tone={data.health >= 80 ? "success" : data.health >= 60 ? "warning" : "danger"} />
        <MetricCard label="Repositories" value={formatNumber(data.repositories)} icon={FolderGit2} href="/repositories" />
        <MetricCard label="Open PRs" value={formatNumber(data.openPrs)} icon={GitPullRequest} href="/pull-requests" />
        <MetricCard label="Open Issues" value={formatNumber(data.openIssues)} icon={CircleDot} href="/issues" />
        <MetricCard label="Deployments" value={formatNumber(data.deployments)} icon={Rocket} href="/cicd" />
        <MetricCard label="Security Alerts" value={formatNumber(data.securityAlerts)} icon={ShieldAlert} href="/security" tone={data.securityAlerts > 0 ? "danger" : "default"} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {/* health panel */}
        <Card className="xl:col-span-1">
          <CardHeader title="Engineering health" subtitle={`${healthLabel(data.health)} · ${data.healthChange > 0 ? "+" : ""}${data.healthChange} this week`} />
          <div className="flex flex-col items-center gap-4 p-5">
            <HealthScore score={data.health} change={data.healthChange} />
            <div className="w-full space-y-1.5">
              {data.topRisks.slice(0, 4).map((r) => (
                <p key={r} className="flex items-center gap-2 text-xs text-muted">
                  <AlertTriangle className="h-3 w-3 shrink-0 text-warning" /> {r}
                </p>
              ))}
            </div>
          </div>
        </Card>

        {/* health trend */}
        <Card className="xl:col-span-2">
          <CardHeader title="Health trend" subtitle="Overall workspace health over time" />
          <div className="p-4">
            <TrendChart
              data={data.healthTrend.map((p) => ({ date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), score: p.score }))}
              series={[{ key: "score", name: "Health", color: "var(--color-accent)" }]}
              height={240}
            />
          </div>
        </Card>
      </div>

      {/* bottleneck + recommendations */}
      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader
            title="Current bottleneck"
            subtitle="Slowest stage in the delivery pipeline"
            action={<Link href="/analytics" className="text-[11px] text-accent hover:underline">details</Link>}
          />
          <div className="p-5">
            {data.bottleneck ? (
              <>
                <p className="font-mono text-2xl font-semibold text-warning">{data.bottleneck}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  This stage is slowing your delivery funnel. Open Analytics for the full funnel and timing breakdown.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted">Not enough merged pull requests to compute a delivery funnel yet.</p>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Recommended actions"
            subtitle={`${data.recommendations.length} active findings`}
            action={
              <Link href="/recommendations" className="flex items-center gap-0.5 text-[11px] text-accent hover:underline">
                all recommendations <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="divide-y divide-border">
            {data.recommendations.slice(0, 3).map((r) => (
              <Link key={r.id} href="/recommendations" className="block px-4 py-3 transition-colors hover:bg-raised/60">
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={r.priority} />
                  <span className="truncate text-[13px] font-medium text-foreground">{r.title}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-muted">{r.reason}</p>
              </Link>
            ))}
            {data.recommendations.length === 0 && (
              <p className="flex items-center gap-2 px-4 py-6 text-xs text-muted">
                <Lightbulb className="h-3.5 w-3.5 text-accent" /> No active recommendations — your system looks healthy.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* recent activity + deployments */}
      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent activity"
            subtitle={`${data.activity.totalCount} events`}
            action={<Link href="/activity" className="text-[11px] text-accent hover:underline">all activity</Link>}
          />
          <ActivityTimeline items={data.activity.edges.map((e) => e.node)} limit={8} />
        </Card>
        <DeploymentTimeline limit={6} />
      </div>
    </div>
  );
}
