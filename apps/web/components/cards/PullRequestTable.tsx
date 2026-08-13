"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search } from "lucide-react";
import { fetchPullRequests } from "@/graphql/queries/code";
import { Card, Input, Select } from "@/components/ui/primitives";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { RiskBadge, PRStateBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { formatDurationShort, formatInt, timeAgo } from "@/lib/utils";
import type { PRStateFilter, PullRequest, RiskFilter } from "@/types/graphql";

export function PullRequestTable({ repositoryId, limit }: { repositoryId?: string; limit?: number }) {
  const [state, setState] = useState<PRStateFilter | "">("");
  const [risk, setRisk] = useState<RiskFilter | "">("");
  const [search, setSearch] = useState("");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["pull-requests", repositoryId, state, risk, search],
    queryFn: () =>
      fetchPullRequests(repositoryId, {
        state: (state || undefined) as PRStateFilter | undefined,
        risk: (risk || undefined) as RiskFilter | undefined,
        label: search || undefined,
      }, { first: limit ?? 100 }),
    placeholderData: (prev) => prev,
  });

  const prs = (data?.edges ?? []).map((e) => e.node);

  if (isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void refetch()} />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input className="pl-8" placeholder="Search pull requests…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search pull requests" />
        </div>
        <Select value={state} onChange={(e) => setState(e.target.value as PRStateFilter | "")} aria-label="Filter by state" className="w-auto min-w-32">
          <option value="">All states</option>
          <option value="OPEN">Open</option>
          <option value="MERGED">Merged</option>
          <option value="CLOSED">Closed</option>
        </Select>
        <Select value={risk} onChange={(e) => setRisk(e.target.value as RiskFilter | "")} aria-label="Filter by risk" className="w-auto min-w-32">
          <option value="">All risk</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </Select>
      </div>

      {isPending ? (
        <LoadingRows rows={6} columns={6} />
      ) : prs.length === 0 ? (
        <EmptyState title="No pull requests found" description="Adjust the filters or check back after the next sync." />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Pull request</Th>
              <Th>State</Th>
              <Th>Author</Th>
              <Th align="right">Files</Th>
              <Th align="right">Changes</Th>
              <Th>Review time</Th>
              <Th>Risk</Th>
              <Th>Updated</Th>
            </Tr>
          </THead>
          <TBody>
            {prs.map((pr: PullRequest) => (
              <Tr key={pr.id} className="tr-hover">
                <Td>
                  <Link href={`/pull-requests/${pr.id}`} className="block hover:text-accent">
                    <span className="text-[13px] font-medium text-foreground">
                      <span className="mr-1.5 font-mono text-xs text-faint">#{pr.githubNumber}</span>
                      {pr.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-subtle">
                      {pr.repository?.name} · {pr.headRef} → {pr.baseRef}
                    </span>
                  </Link>
                </Td>
                <Td>
                  <PRStateBadge state={pr.state} />
                </Td>
                <Td className="font-mono text-xs text-muted">{pr.authorLogin}</Td>
                <Td align="right" className="font-mono text-xs">{pr.changedFiles}</Td>
                <Td align="right" className="font-mono text-xs">
                  <span className="text-success">+{formatInt(pr.additions)}</span>{" "}
                  <span className="text-danger">−{formatInt(pr.deletions)}</span>
                </Td>
                <Td className="font-mono text-xs text-muted">{formatDurationShort(pr.reviewTimeMs)}</Td>
                <Td>
                  {pr.risk ? <RiskBadge level={pr.risk.level} score={pr.risk.score} /> : <span className="text-faint">—</span>}
                </Td>
                <Td className="font-mono text-xs text-faint">{timeAgo(pr.updatedAt ?? pr.createdAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
