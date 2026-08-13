"use client";

import { useQuery } from "@tanstack/react-query";
import { Rocket, XCircle } from "lucide-react";
import { fetchDeployments } from "@/graphql/queries/supply";
import { Card, CardHeader } from "@/components/ui/primitives";
import { DeploymentStatusBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { formatDuration, timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Deployment } from "@/types/graphql";

export function DeploymentTimeline({ repositoryId, limit = 12 }: { repositoryId?: string; limit?: number }) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["deployments", repositoryId],
    queryFn: () => fetchDeployments(repositoryId, { first: limit }),
    placeholderData: (prev) => prev,
  });

  const deployments = (data?.edges ?? []).map((e) => e.node);

  if (isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void refetch()} />
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card>
        <LoadingRows rows={5} columns={4} />
      </Card>
    );
  }

  if (!deployments.length) {
    return (
      <Card>
        <EmptyState title="No deployments yet" description="Deployments tracked by GitHub appear here." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Deployments" subtitle="Recent deployment activity" />
      <ol className="divide-y divide-border">
        {deployments.map((d: Deployment) => {
          const ok = d.status === "SUCCESS";
          return (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border", ok ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger")}>
                {ok ? <Rocket className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-foreground">
                  <span className="mr-1.5 font-mono text-xs text-accent">{d.version ?? d.ref}</span>
                  {d.description ?? "Deployment"}
                  {d.repository && !repositoryId && <span className="ml-1.5 font-mono text-[11px] text-subtle">· {d.repository.name}</span>}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-subtle">
                  {d.environment} · {timeAgo(d.createdAt)}
                  {(() => {
                    const dur = d.updatedAt ? new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime() : null;
                    return dur && dur > 0 ? ` · ${formatDuration(dur)}` : "";
                  })()}
                </p>
              </div>
              <DeploymentStatusBadge status={d.status} />
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
