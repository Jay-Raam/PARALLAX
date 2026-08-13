"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { fetchDependencies } from "@/graphql/queries/supply";
import { Card, Input, Select } from "@/components/ui/primitives";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { RiskBadge, UpdateTypeBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import type { Dependency, DependencyFilter, UpdateType } from "@/types/graphql";

const FILTER_TO_TYPE: Record<string, UpdateType | "SECURITY" | "ALL"> = {
  ALL: "ALL",
  CRITICAL: "ALL",
  MAJOR: "MAJOR",
  MINOR: "MINOR",
  PATCH: "PATCH",
  SECURITY: "SECURITY",
};

export function DependencyTable({ repositoryId }: { repositoryId?: string }) {
  const [filter, setFilter] = useState<DependencyFilter>("ALL");
  const [search, setSearch] = useState("");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["dependencies", repositoryId, filter, search],
    queryFn: () =>
      fetchDependencies(repositoryId, {
        update: filter as DependencyFilter,
        search: search || undefined,
      }, { first: 100 }),
    placeholderData: (prev) => prev,
  });

  const deps = (data?.edges ?? []).map((e) => e.node);
  const visible =
    filter === "CRITICAL"
      ? deps.filter((d) => d.risk === "CRITICAL" || d.risk === "HIGH")
      : filter === "SECURITY"
        ? deps.filter((d) => d.vulnerabilities.length > 0)
        : deps;

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
          <Input className="pl-8" placeholder="Search packages…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search dependencies" />
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as DependencyFilter)} aria-label="Filter dependencies" className="w-auto min-w-32">
          <option value="ALL">All</option>
          <option value="CRITICAL">Critical</option>
          <option value="MAJOR">Major</option>
          <option value="MINOR">Minor</option>
          <option value="PATCH">Patch</option>
          <option value="SECURITY">Security</option>
        </Select>
      </div>

      {isPending ? (
        <LoadingRows rows={8} columns={6} />
      ) : visible.length === 0 ? (
        <EmptyState title="No dependencies found" description={FILTER_TO_TYPE[filter] === "SECURITY" ? "No dependencies with known vulnerabilities." : "Dependencies appear after the repository is analyzed."} />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Package</Th>
              <Th>Ecosystem</Th>
              <Th>Current</Th>
              <Th>Latest</Th>
              <Th>Update</Th>
              <Th>Risk</Th>
              <Th>Vulnerabilities</Th>
            </Tr>
          </THead>
          <TBody>
            {visible.map((d: Dependency) => (
              <Tr key={d.id} className="tr-hover">
                <Td>
                  <span className="font-mono text-[13px] font-medium text-foreground">{d.name}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-subtle">{d.repository?.name}</span>
                </Td>
                <Td className="font-mono text-xs text-muted">{d.ecosystem}</Td>
                <Td className="font-mono text-xs text-foreground">{d.currentVersion}</Td>
                <Td className="font-mono text-xs text-accent">{d.latestVersion ?? "—"}</Td>
                <Td>
                  <UpdateTypeBadge updateType={d.updateType} />
                </Td>
                <Td>
                  <RiskBadge level={d.risk} />
                </Td>
                <Td>
                  {d.vulnerabilities.length > 0 ? (
                    <span className="font-mono text-xs text-danger">{d.vulnerabilities.length}</span>
                  ) : (
                    <span className="font-mono text-xs text-faint">0</span>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
