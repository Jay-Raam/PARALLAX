"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchContributors } from "@/graphql/queries/supply";
import { Card } from "@/components/ui/primitives";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/primitives";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { formatInt, initials, timeAgo } from "@/lib/utils";
import type { Contributor } from "@/types/graphql";

export function ContributorTable({ repositoryId, limit = 50 }: { repositoryId?: string; limit?: number }) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["contributors", repositoryId],
    queryFn: () => fetchContributors(repositoryId, { first: limit }),
    placeholderData: (prev) => prev,
  });

  const contributors = (data?.edges ?? []).map((e) => e.node);

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
        <LoadingRows rows={8} columns={6} />
      </Card>
    );
  }

  if (!contributors.length) {
    return (
      <Card>
        <EmptyState title="No contributors yet" description="Contributors appear after the first sync." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <Tr>
            <Th>Contributor</Th>
            <Th>Role</Th>
            <Th align="right">Commits</Th>
            <Th align="right">Additions</Th>
            <Th align="right">Deletions</Th>
            <Th align="right">PRs</Th>
            <Th align="right">Reviews</Th>
            <Th>Last activity</Th>
          </Tr>
        </THead>
        <TBody>
          {contributors.map((c: Contributor) => (
            <Tr key={c.id} className="tr-hover">
              <Td>
                <div className="flex items-center gap-2.5">
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatarUrl} alt="" className="h-6 w-6 rounded-full border border-border" loading="lazy" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-raised font-mono text-[10px] text-muted">
                      {initials(c.name ?? c.login)}
                    </span>
                  )}
                  <div>
                    <p className="font-mono text-[13px] font-medium text-foreground">{c.login}</p>
                    <p className="text-[11px] text-subtle">{c.name}</p>
                  </div>
                </div>
              </Td>
              <Td>
                <Badge tone="muted">{c.role}</Badge>
              </Td>
              <Td align="right" className="font-mono text-xs">{formatInt(c.commits)}</Td>
              <Td align="right" className="font-mono text-xs text-success">+{formatInt(c.additions)}</Td>
              <Td align="right" className="font-mono text-xs text-danger">−{formatInt(c.deletions)}</Td>
              <Td align="right" className="font-mono text-xs">{formatInt(c.pullRequestsCreated)}</Td>
              <Td align="right" className="font-mono text-xs">{formatInt(c.reviewsGiven)}</Td>
              <Td className="font-mono text-xs text-faint">{timeAgo(c.lastContributionAt)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
