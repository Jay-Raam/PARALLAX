"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRecommendations } from "@/graphql/queries/recommendations";
import { dismissRecommendation, markRecommendationComplete } from "@/graphql/mutations";
import { PageHeader } from "@/components/ui/primitives";
import { Card } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { RecommendationCard } from "@/components/cards/RecommendationCard";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import type { RecommendationStatus } from "@/types/graphql";

export default function RecommendationsPage() {
  const [status, setStatus] = useState<RecommendationStatus>("ACTIVE");
  const queryClient = useQueryClient();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["recommendations", status],
    queryFn: () => fetchRecommendations(status, { first: 100 }),
    placeholderData: (prev) => prev,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    void queryClient.invalidateQueries({ queryKey: ["overview"] });
  };

  const recommendations = data?.edges.map((e) => e.node) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Engineering Recommendations"
        subtitle="Measurable findings with evidence and a suggested action for each."
      />

      <Tabs
        tabs={[
          { value: "ACTIVE", label: "Active", count: data?.totalCount },
          { value: "COMPLETED", label: "Completed" },
          { value: "DISMISSED", label: "Dismissed" },
        ]}
        value={status}
        onChange={setStatus}
      />

      {isPending ? (
        <Card>
          <LoadingRows rows={6} columns={3} />
        </Card>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : recommendations.length === 0 ? (
        <Card>
          <EmptyState
            title={status === "ACTIVE" ? "No active recommendations" : `No ${status.toLowerCase()} recommendations`}
            description={
              status === "ACTIVE"
                ? "Your engineering system looks healthy. New findings appear here as the data changes."
                : "Dismissed and completed recommendations will show up here."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {recommendations.map((r) => (
            <RecommendationCard
              key={r.id}
              recommendation={r}
              onComplete={(id) => void markRecommendationComplete(id).then(invalidate)}
              onDismiss={(id) => void dismissRecommendation(id).then(invalidate)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
