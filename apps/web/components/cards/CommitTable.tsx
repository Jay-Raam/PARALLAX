"use client";

import { useQuery } from "@tanstack/react-query";
import { GitCommitHorizontal } from "lucide-react";
import { fetchCommits } from "@/graphql/queries/code";
import { Card, Select } from "@/components/ui/primitives";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { ClassificationBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { formatDateTime, formatInt } from "@/lib/utils";
import { useState } from "react";
import type { Commit, CommitClassification } from "@/types/graphql";

export function CommitTable({ repositoryId, limit = 50 }: { repositoryId: string; limit?: number }) {
  const [classification, setClassification] = useState<CommitClassification | "">("");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["commits", repositoryId, classification],
    queryFn: () =>
      fetchCommits(repositoryId, { classification: (classification || undefined) as CommitClassification | undefined }, { first: limit }),
    placeholderData: (prev) => prev,
  });

  const commits = (data?.edges ?? []).map((e) => e.node);

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
        <p className="text-xs text-muted">{data?.totalCount ?? 0} commits</p>
        <Select value={classification} onChange={(e) => setClassification(e.target.value as CommitClassification | "")} className="w-auto min-w-36" aria-label="Filter by classification">
          <option value="">All types</option>
          <option value="feature">Feature</option>
          <option value="bugfix">Bug fix</option>
          <option value="refactor">Refactor</option>
          <option value="docs">Docs</option>
          <option value="tests">Tests</option>
          <option value="chore">Chore</option>
          <option value="dependency">Dependency</option>
        </Select>
      </div>

      {isPending ? (
        <LoadingRows rows={8} columns={5} />
      ) : commits.length === 0 ? (
        <EmptyState title="No commits found" description="Commits appear after the repository is synced." />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Commit</Th>
              <Th>Author</Th>
              <Th>Type</Th>
              <Th align="right">Files</Th>
              <Th align="right">Δ</Th>
              <Th>Date</Th>
            </Tr>
          </THead>
          <TBody>
            {commits.map((c: Commit) => (
              <Tr key={c.id} className="tr-hover">
                <Td>
                  <div className="flex items-center gap-2">
                    <GitCommitHorizontal className="h-3.5 w-3.5 shrink-0 text-faint" />
                    <div className="min-w-0">
                      <p className="max-w-md truncate text-[13px] text-foreground">{c.messageTitle}</p>
                      <p className="font-mono text-[10.5px] text-faint">{c.sha.slice(0, 7)}</p>
                    </div>
                  </div>
                </Td>
                <Td className="font-mono text-xs text-muted">{c.authorLogin || c.authorName}</Td>
                <Td>
                  <ClassificationBadge classification={c.classification} />
                </Td>
                <Td align="right" className="font-mono text-xs">{c.filesChanged}</Td>
                <Td align="right" className="font-mono text-xs">
                  <span className="text-success">+{formatInt(c.additions)}</span> <span className="text-danger">−{formatInt(c.deletions)}</span>
                </Td>
                <Td className="font-mono text-xs text-faint">{formatDateTime(c.date)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
