"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchWorkflowRuns } from "@/graphql/queries/supply";
import { Card, Select } from "@/components/ui/primitives";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { WorkflowStatusBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { formatDuration, formatDateTime, truncate } from "@/lib/utils";
import type { WorkflowRun } from "@/types/graphql";

export function WorkflowTable({ repositoryId, limit = 50 }: { repositoryId?: string; limit?: number }) {
  const [status, setStatus] = useState("");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["workflow-runs", repositoryId, status],
    queryFn: () => fetchWorkflowRuns(repositoryId, { status: (status || undefined) as never }, { first: limit }),
    placeholderData: (prev) => prev,
  });

  const runs = (data?.edges ?? []).map((e) => e.node);

  if (isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void refetch()} />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-3">
        <p className="text-xs text-muted">{data?.totalCount ?? 0} runs</p>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto min-w-36" aria-label="Filter workflow status">
          <option value="">All statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILURE">Failure</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      {isPending ? (
        <LoadingRows rows={8} columns={5} />
      ) : runs.length === 0 ? (
        <EmptyState title="No workflow runs" description="CI/CD runs appear after the repository is synced." />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Workflow</Th>
              <Th>Status</Th>
              <Th>Branch</Th>
              <Th>Event</Th>
              <Th>Duration</Th>
              <Th>Started</Th>
            </Tr>
          </THead>
          <TBody>
            {runs.map((r: WorkflowRun) => (
              <Tr key={r.id} className="tr-hover">
                <Td>
                  <p className="text-[13px] font-medium text-foreground">
                    {r.workflowName}
                    <span className="ml-1.5 font-mono text-[11px] text-faint">#{r.runNumber}</span>
                  </p>
                  <p className="mt-0.5 max-w-56 truncate font-mono text-[10.5px] text-subtle">
                    {r.repository?.name} · {truncate(r.headSha, 10)}
                  </p>
                </Td>
                <Td>
                  <WorkflowStatusBadge status={r.status} />
                </Td>
                <Td className="font-mono text-xs text-muted">{r.branch}</Td>
                <Td className="font-mono text-xs text-muted">{r.event}</Td>
                <Td className="font-mono text-xs">{formatDuration(r.durationMs)}</Td>
                <Td className="font-mono text-xs text-faint">{formatDateTime(r.createdAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
