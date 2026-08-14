"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchActivity } from "@/graphql/queries/activity";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader, Button } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { ActivityTimeline } from "@/components/cards/ActivityTimeline";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";
import type { ActivityFilter } from "@/types/graphql";

const FILTERS: Array<{ value: ActivityFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "COMMITS", label: "Commits" },
  { value: "PRS", label: "Pull Requests" },
  { value: "REVIEWS", label: "Reviews" },
  { value: "ISSUES", label: "Issues" },
  { value: "DEPLOYMENTS", label: "Deployments" },
  { value: "RELEASES", label: "Releases" },
  { value: "SECURITY", label: "Security" },
  { value: "CI", label: "CI" },
];

export default function ActivityPage() {
  const [filter, setFilter] = useState<ActivityFilter>("ALL");
  const [after, setAfter] = useState<string | undefined>(undefined);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["activity", filter, after],
    queryFn: () => fetchActivity(filter === "ALL" ? undefined : [filter], { first: 40, after }),
    placeholderData: (prev) => prev,
  });

  const items = data?.edges.map((e) => e.node) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title="Engineering Activity" subtitle="A single timeline across every connected repository." />

      <Tabs tabs={FILTERS} value={filter} onChange={(v) => { setFilter(v); setAfter(undefined); }} />

      <Card>
        <CardHeader title="Timeline" subtitle={`${data?.totalCount ?? 0} events`} />
        {isPending ? (
          <LoadingRows rows={10} columns={3} />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <p className="px-4 py-12 text-center text-xs text-muted">No activity in this category yet.</p>
        ) : (
          <>
            <ActivityTimeline items={items} showTime />
            {data?.pageInfo.hasNextPage && (
              <div className="border-t border-border p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setAfter(data.pageInfo.endCursor ?? undefined)}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
