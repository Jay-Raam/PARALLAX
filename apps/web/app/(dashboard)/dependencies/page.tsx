"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDependencyAnalytics } from "@/graphql/queries/analytics";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader } from "@/components/ui/primitives";
import { MetricCard } from "@/components/cards/MetricCard";
import { DependencyTable } from "@/components/cards/DependencyTable";
import { Donut } from "@/components/charts/Donut";
import { HBarList } from "@/components/charts/Bars";
import { ErrorState } from "@/components/ui/feedback";

export default function DependenciesPage() {
  const { data, isError, refetch } = useQuery({
    queryKey: ["dependency-analytics"],
    queryFn: () => fetchDependencyAnalytics(undefined),
    placeholderData: (prev) => prev,
  });

  const updateData = (data?.byUpdateType ?? []).map((d) => ({ name: d.updateType, value: d.count }));
  const severityData = (data?.bySeverity ?? []).map((d) => ({ name: d.severity, value: d.count }));

  return (
    <div className="space-y-5">
      <PageHeader title="Dependency Radar" subtitle="Every outdated and vulnerable package, prioritized by risk." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Total packages" value={data?.total ?? "—"} />
        <MetricCard label="Outdated" value={data?.outdated ?? "—"} tone={(data?.outdated ?? 0) > 0 ? "warning" : "default"} />
        <MetricCard label="Vulnerable" value={data?.vulnerable ?? "—"} tone={(data?.vulnerable ?? 0) > 0 ? "danger" : "default"} />
        <MetricCard label="Critical risk" value={data?.critical ?? "—"} tone={(data?.critical ?? 0) > 0 ? "danger" : "default"} />
        <MetricCard label="Majors behind" value={updateData.find((d) => d.name === "MAJOR")?.value ?? "—"} />
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}

      <div className="grid gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader title="Update type" subtitle="How far each package is behind" />
          <div className="flex justify-center p-4">
            <Donut data={updateData} centerValue={data?.outdated ?? 0} centerLabel="outdated" size={170} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Severity" subtitle="Known vulnerabilities by severity" />
          <div className="flex justify-center p-4">
            <Donut data={severityData} centerValue={data?.vulnerable ?? 0} centerLabel="vulnerable" size={170} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Top outdated" subtitle="Biggest version gaps" />
          <div className="space-y-3 p-4">
            <HBarList
              items={(data?.topOutdated ?? []).slice(0, 8).map((d) => ({
                label: `${d.name} ${d.currentVersion} → ${d.latestVersion ?? "?"}`,
                value: d.updateType === "MAJOR" ? 3 : d.updateType === "MINOR" ? 2 : 1,
                color: d.risk === "HIGH" || d.risk === "CRITICAL" ? "var(--color-danger)" : d.risk === "MEDIUM" ? "var(--color-warning)" : "var(--color-accent)",
              }))}
            />
          </div>
        </Card>
      </div>

      <DependencyTable />
    </div>
  );
}
