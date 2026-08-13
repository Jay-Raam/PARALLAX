"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchIssues } from "@/graphql/queries/code";
import { Card } from "@/components/ui/primitives";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { IssueStateBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/utils";
import type { Issue } from "@/types/graphql";

export function IssueTable({
  repositoryId,
  filters,
  limit,
  linkPrefix = "/issues",
}: {
  repositoryId?: string;
  filters?: { stale?: boolean; critical?: boolean; state?: string };
  limit?: number;
  linkPrefix?: string;
}) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["issues", repositoryId, filters?.stale, filters?.critical, filters?.state],
    queryFn: () => fetchIssues(repositoryId, filters as never, { first: limit ?? 100 }),
    placeholderData: (prev) => prev,
  });

  const issues = (data?.edges ?? []).map((e) => e.node);

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
        <LoadingRows rows={6} columns={5} />
      </Card>
    );
  }

  if (!issues.length) {
    return (
      <Card>
        <EmptyState title="No issues found" description="Issues appear here after the repository is synced." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <Tr>
            <Th>Issue</Th>
            <Th>Status</Th>
            <Th>Author</Th>
            <Th>Labels</Th>
            <Th align="right">Comments</Th>
            <Th>Inactive</Th>
            <Th>Updated</Th>
          </Tr>
        </THead>
        <TBody>
          {issues.map((issue: Issue) => (
            <Tr key={issue.id} className="tr-hover">
              <Td>
                <Link href={`${linkPrefix}/${issue.id}`} className="block hover:text-accent">
                  <span className="text-[13px] font-medium text-foreground">
                    <span className="mr-1.5 font-mono text-xs text-faint">#{issue.githubNumber}</span>
                    {issue.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-subtle">{issue.repository?.name}</span>
                </Link>
              </Td>
              <Td>
                <IssueStateBadge state={issue.state} stale={issue.isStale} critical={issue.isCritical} />
              </Td>
              <Td className="font-mono text-xs text-muted">{issue.authorLogin}</Td>
              <Td>
                <div className="flex max-w-52 flex-wrap gap-1">
                  {issue.labels.slice(0, 3).map((l) => (
                    <span key={l} className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">
                      {l}
                    </span>
                  ))}
                  {issue.labels.length > 3 && <span className="text-[10px] text-faint">+{issue.labels.length - 3}</span>}
                </div>
              </Td>
              <Td align="right" className="font-mono text-xs">{issue.commentsCount}</Td>
              <Td className="font-mono text-xs text-muted">{issue.daysInactive}d</Td>
              <Td className="font-mono text-xs text-faint">{formatDateTime(issue.updatedAt ?? issue.createdAt)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
