"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { GitBranch, ExternalLink } from "lucide-react";
import { fetchPullRequest } from "@/graphql/queries/code";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader } from "@/components/ui/primitives";
import { PRHeader, PRMetrics, PRRiskPanel, PRLifecycle } from "@/components/cards/PRDetail";
import { ErrorState, PageLoading } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import type { PullRequestReview } from "@/types/graphql";

export default function PullRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: pr, isPending, isError, refetch } = useQuery({
    queryKey: ["pull-request", id],
    queryFn: () => fetchPullRequest(id),
  });

  if (isPending) return <PageLoading />;
  if (isError || !pr) {
    return <ErrorState onRetry={() => void refetch()} description="This pull request could not be loaded." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={<PRHeader pr={pr} />}
        actions={
          pr.repository?.url && (
            <a href={pr.repository.url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
              View on GitHub <ExternalLink className="h-3 w-3" />
            </a>
          )
        }
      />

      <div className="grid gap-3 xl:grid-cols-2">
        <PRRiskPanel pr={pr} />
        <PRLifecycle pr={pr} />
      </div>

      <PRMetrics pr={pr} />

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Changed files" subtitle={`${pr.changedFiles} files`} />
          <div className="grid gap-px bg-border sm:grid-cols-2">
            {pr.files.slice(0, 24).map((f) => (
              <div key={f} className="bg-surface px-3 py-2">
                <p className="truncate font-mono text-[11px] text-muted">{f}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Reviews" subtitle={`${pr.reviews.length} reviews`} />
          <div className="divide-y divide-border">
            {pr.reviews.length === 0 && <p className="px-4 py-6 text-center text-xs text-muted">No reviews yet.</p>}
            {pr.reviews.map((r: PullRequestReview) => (
              <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-raised font-mono text-[10px] text-muted">
                  {r.reviewerLogin.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-foreground">
                    <span className="font-mono text-accent">{r.reviewerLogin}</span>{" "}
                    <Badge tone={r.state === "APPROVED" ? "success" : r.state === "CHANGES_REQUESTED" ? "danger" : "muted"}>{r.state.replace(/_/g, " ")}</Badge>
                  </p>
                  {r.body && <p className="mt-1 line-clamp-3 text-xs text-muted">{r.body}</p>}
                  {r.submittedAt && <p className="mt-1 font-mono text-[10px] text-faint">{formatDateTime(r.submittedAt)}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {pr.body && (
        <Card>
          <CardHeader title="Description" />
          <p className="whitespace-pre-wrap px-4 py-3 text-[13px] leading-relaxed text-muted">{pr.body}</p>
        </Card>
      )}

      <p className="flex items-center gap-2 text-[11px] text-faint">
        <GitBranch className="h-3 w-3" /> {pr.baseRef} ← {pr.headRef} ·{" "}
        {pr.repository && (
          <Link href={`/repositories/${pr.repository.id}`} className="font-mono text-accent hover:underline">
            {pr.repository.fullName}
          </Link>
        )}
      </p>
    </div>
  );
}
