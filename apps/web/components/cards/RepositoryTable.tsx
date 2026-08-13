"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search } from "lucide-react";
import { fetchRepositories } from "@/graphql/queries/repositories";
import { Card, Input, Select } from "@/components/ui/primitives";
import { Table, THead, TBody, Tr, Th, Td, SortHeader } from "@/components/ui/table";
import { HealthBadge, SyncStatusBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { formatNumber, timeAgo } from "@/lib/utils";
import type { RepoActivityFilter, RepoHealthFilter, RepoSort, Repository } from "@/types/graphql";

export function RepositoryTable() {
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState<RepoHealthFilter | "">("");
  const [activity, setActivity] = useState<RepoActivityFilter | "">("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["repositories", search, health, activity, sort?.key, sort?.dir],
    queryFn: () =>
      fetchRepositories(
        {
          search: search || undefined,
          health: (health || undefined) as RepoHealthFilter | undefined,
          activity: (activity || undefined) as RepoActivityFilter | undefined,
          sort: sort?.key as RepoSort | undefined,
        },
        { first: 200 },
      ),
    placeholderData: (prev) => prev,
  });

  const repos = useMemo(() => {
    const list = data?.edges.map((e) => e.node) ?? [];
    if (sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      list.sort((a, b) => {
        const key = sort.key;
        if (key === "health") return ((a.health?.overall ?? -1) - (b.health?.overall ?? -1)) * dir;
        if (key === "activity") return ((a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0) - (b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0)) * dir;
        if (key === "prs") return ((a.counts?.openPrs ?? 0) - (b.counts?.openPrs ?? 0)) * dir;
        if (key === "issues") return ((a.counts?.openIssues ?? 0) - (b.counts?.openIssues ?? 0)) * dir;
        return a.name.localeCompare(b.name) * dir;
      });
    }
    return list;
  }, [data, sort]);

  if (isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void refetch()} description="Repositories could not be loaded." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input className="pl-8" placeholder="Search repositories…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search repositories" />
        </div>
        <Select value={health} onChange={(e) => setHealth(e.target.value as RepoHealthFilter | "")} aria-label="Filter by health" className="w-auto min-w-36">
          <option value="">All health</option>
          <option value="HEALTHY">Healthy</option>
          <option value="NEEDS_ATTENTION">Needs attention</option>
          <option value="AT_RISK">At risk</option>
        </Select>
        <Select value={activity} onChange={(e) => setActivity(e.target.value as RepoActivityFilter | "")} aria-label="Filter by activity" className="w-auto min-w-36">
          <option value="">All activity</option>
          <option value="ACTIVE">Active</option>
          <option value="IDLE">Idle</option>
          <option value="NEW">New</option>
        </Select>
      </div>

      {isPending ? (
        <LoadingRows rows={6} columns={6} />
      ) : repos.length === 0 ? (
        <EmptyState
          title={search ? "No repositories match your search" : "No repositories connected"}
          description={search ? "Try a different name or clear the filters." : "Connect a GitHub repository to start measuring engineering health."}
        />
      ) : (
        <Table>
          <THead>
            <Tr>
              <SortHeader label="Repository" sortKey="name" activeSort={sort} onSort={(k) => setSort({ key: k, dir: sort?.key === k && sort.dir === "asc" ? "desc" : "asc" })} />
              <SortHeader label="Health" sortKey="health" activeSort={sort} onSort={(k) => setSort({ key: k, dir: sort?.key === k && sort.dir === "asc" ? "desc" : "asc" })} />
              <Th>Language</Th>
              <SortHeader label="Open PRs" sortKey="prs" activeSort={sort} onSort={(k) => setSort({ key: k, dir: sort?.key === k && sort.dir === "asc" ? "desc" : "asc" })} />
              <SortHeader label="Issues" sortKey="issues" activeSort={sort} onSort={(k) => setSort({ key: k, dir: sort?.key === k && sort.dir === "asc" ? "desc" : "asc" })} />
              <SortHeader label="Activity" sortKey="activity" activeSort={sort} onSort={(k) => setSort({ key: k, dir: sort?.key === k && sort.dir === "asc" ? "desc" : "asc" })} />
              <Th>Status</Th>
            </Tr>
          </THead>
          <TBody>
            {repos.map((repo: Repository) => (
              <Tr key={repo.id} className="tr-hover">
                <Td>
                  <Link href={`/repositories/${repo.id}`} className="font-mono text-[13px] font-medium text-foreground hover:text-accent">
                    {repo.name}
                  </Link>
                  {repo.description && <p className="max-w-md truncate text-xs text-subtle">{repo.description}</p>}
                </Td>
                <Td>
                  <HealthBadge score={repo.health?.overall} />
                </Td>
                <Td>
                  <span className="font-mono text-xs text-muted">{repo.language ?? "—"}</span>
                </Td>
                <Td className="font-mono text-xs">{formatNumber(repo.counts?.openPrs)}</Td>
                <Td className="font-mono text-xs">{formatNumber(repo.counts?.openIssues)}</Td>
                <Td className="font-mono text-xs text-muted">{timeAgo(repo.lastActivityAt)}</Td>
                <Td>
                  <SyncStatusBadge status={repo.syncStatus} />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
