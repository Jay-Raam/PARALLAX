"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRepositoryComparison } from "@/graphql/queries/repositories";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader } from "@/components/ui/primitives";
import { RepositoryTable } from "@/components/cards/RepositoryTable";
import { Bars } from "@/components/charts/Bars";
import { ErrorState } from "@/components/ui/feedback";
import { formatInt } from "@/lib/utils";

export default function RepositoriesPage() {
  const { data, isError, refetch } = useQuery({
    queryKey: ["repository-comparison"],
    queryFn: () => fetchRepositoryComparison("_30D"),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Repositories"
        subtitle="Health, activity and delivery across every connected repository."
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Repository comparison" subtitle="Commits and health over the last 30 days" />
          <div className="p-4">
            <Bars
              data={(data ?? []).map((r) => ({ name: r.name, Commits: r.commits, Health: r.health }))}
              dataKey="Commits"
              name="Commits"
              height={220}
              formatValue={formatInt}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Health by repository" subtitle="Current health score" />
          <div className="space-y-2.5 p-4">
            {(data ?? []).slice(0, 8).map((r) => (
              <div key={r.repositoryId}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate font-mono text-xs text-muted">{r.name}</span>
                  <span className="font-mono text-xs" style={{ color: r.health >= 80 ? "var(--color-success)" : r.health >= 60 ? "var(--color-warning)" : "var(--color-danger)" }}>
                    {r.health}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
                  <div className="h-full rounded-full" style={{ width: `${r.health}%`, background: r.health >= 80 ? "var(--color-success)" : r.health >= 60 ? "var(--color-warning)" : "var(--color-danger)" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}

      <RepositoryTable />
    </div>
  );
}
