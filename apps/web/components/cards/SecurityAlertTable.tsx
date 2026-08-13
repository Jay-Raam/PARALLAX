"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { fetchSecurityAlerts } from "@/graphql/queries/supply";
import { Card } from "@/components/ui/primitives";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { SeverityBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { formatDate, titleCase } from "@/lib/utils";
import type { SecurityAlert } from "@/types/graphql";

export function SecurityAlertTable({ repositoryId, limit }: { repositoryId?: string; limit?: number }) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["security-alerts", repositoryId],
    queryFn: () => fetchSecurityAlerts(repositoryId, undefined, { first: limit ?? 100 }),
    placeholderData: (prev) => prev,
  });

  const alerts = (data?.edges ?? []).map((e) => e.node);

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

  if (!alerts.length) {
    return (
      <Card>
        <EmptyState title="No security alerts" description="No open security alerts across your repositories." />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <Tr>
            <Th>Alert</Th>
            <Th>Severity</Th>
            <Th>Category</Th>
            <Th>Package</Th>
            <Th>State</Th>
            <Th>Reported</Th>
          </Tr>
        </THead>
        <TBody>
          {alerts.map((a: SecurityAlert) => (
            <Tr key={a.id} className="tr-hover">
              <Td>
                <a
                  href={a.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:text-accent"
                >
                  {a.title}
                  <ExternalLink className="h-3 w-3 text-faint group-hover:text-accent" />
                </a>
                <span className="mt-0.5 block font-mono text-[11px] text-subtle">{a.repository?.name}</span>
              </Td>
              <Td>
                <SeverityBadge severity={a.severity} />
              </Td>
              <Td className="text-xs text-muted">{titleCase(a.type.replace(/_/g, " "))}</Td>
              <Td className="font-mono text-xs">{a.packageName ?? "—"}</Td>
              <Td className="font-mono text-xs text-muted">{a.state}</Td>
              <Td className="font-mono text-xs text-faint">{formatDate(a.createdAt)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
