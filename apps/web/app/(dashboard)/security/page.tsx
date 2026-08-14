"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSecurityAnalytics } from "@/graphql/queries/analytics";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader } from "@/components/ui/primitives";
import { MetricCard } from "@/components/cards/MetricCard";
import { HealthScore } from "@/components/cards/HealthScore";
import { SecurityAlertTable } from "@/components/cards/SecurityAlertTable";
import { HBarList } from "@/components/charts/Bars";
import { ErrorState } from "@/components/ui/feedback";

export default function SecurityPage() {
  const { data, isError, refetch } = useQuery({
    queryKey: ["security-analytics"],
    queryFn: () => fetchSecurityAnalytics(undefined),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Security Center" subtitle="Dependabot, secret scanning and workflow security in one view." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Security score" value={data?.score ?? "—"} tone={(data?.score ?? 100) >= 80 ? "success" : (data?.score ?? 100) >= 60 ? "warning" : "danger"} />
        <MetricCard label="Critical" value={data?.critical ?? "—"} tone={(data?.critical ?? 0) > 0 ? "danger" : "default"} />
        <MetricCard label="High" value={data?.high ?? "—"} tone={(data?.high ?? 0) > 0 ? "danger" : "default"} />
        <MetricCard label="Medium" value={data?.medium ?? "—"} tone={(data?.medium ?? 0) > 0 ? "warning" : "default"} />
        <MetricCard label="Low" value={data?.low ?? "—"} />
        <MetricCard label="Open" value={data?.open ?? "—"} />
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}

      <div className="grid gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader title="Security posture" subtitle="Aggregate score" />
          <div className="flex justify-center p-5">
            <HealthScore score={data?.score} size="md" label="SECURE" />
          </div>
        </Card>
        <Card>
          <CardHeader title="By category" subtitle="Alerts grouped by source" />
          <div className="p-4">
            <HBarList
              items={(data?.byCategory ?? []).map((c) => ({
                label: c.category.replace(/_/g, " "),
                value: c.count,
                color: "var(--color-danger)",
              }))}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Alert state" />
          <div className="p-4">
            <HBarList
              items={[
                { label: "Open", value: data?.open ?? 0, color: "var(--color-danger)" },
                { label: "Fixed", value: data?.fixed ?? 0, color: "var(--color-success)" },
              ]}
            />
          </div>
        </Card>
      </div>

      <SecurityAlertTable />
    </div>
  );
}
