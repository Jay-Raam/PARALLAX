"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchIssue } from "@/graphql/queries/code";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader } from "@/components/ui/primitives";
import { IssueStateBadge } from "@/components/ui/badges";
import { ErrorState, PageLoading } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/utils";

export default function IssueDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: issue, isPending, isError, refetch } = useQuery({
    queryKey: ["issue", params.id],
    queryFn: () => fetchIssue(params.id),
  });

  if (isPending) return <PageLoading />;
  if (isError || !issue) {
    return <ErrorState onRetry={() => void refetch()} description="This issue could not be loaded." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-faint">#{issue.githubNumber}</span>
            <IssueStateBadge state={issue.state} stale={issue.isStale} critical={issue.isCritical} />
          </div>
        }
        subtitle={<span className="text-base font-semibold text-foreground">{issue.title}</span>}
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader title="Description" />
            <p className="whitespace-pre-wrap px-4 py-3 text-[13px] leading-relaxed text-muted">
              {issue.body ?? "No description provided."}
            </p>
          </Card>
        </div>

        <Card>
          <CardHeader title="Details" />
          <dl className="space-y-2.5 p-4 text-xs">
            <Row label="Repository" value={issue.repository ? <Link className="font-mono text-accent hover:underline" href={`/repositories/${issue.repository.id}`}>{issue.repository.name}</Link> : "—"} />
            <Row label="Author" value={<span className="font-mono">{issue.authorLogin}</span>} />
            <Row label="Created" value={formatDateTime(issue.createdAt)} mono />
            <Row label="Updated" value={formatDateTime(issue.updatedAt)} mono />
            <Row label="Closed" value={issue.closedAt ? formatDateTime(issue.closedAt) : "—"} mono />
            <Row label="Inactive for" value={`${issue.daysInactive} days`} mono />
            <Row label="Comments" value={String(issue.commentsCount)} mono />
            <div>
              <dt className="mb-1 text-muted">Assignees</dt>
              <dd className="flex flex-wrap gap-1">
                {issue.assignees.length ? issue.assignees.map((a) => <span key={a} className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-[11px] text-muted">{a}</span>) : <span className="text-faint">none</span>}
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-muted">Labels</dt>
              <dd className="flex flex-wrap gap-1">
                {issue.labels.length ? issue.labels.map((l) => <span key={l} className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-[11px] text-muted">{l}</span>) : <span className="text-faint">none</span>}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "font-mono text-[11px] text-foreground" : "text-right text-foreground"}>{value}</dd>
    </div>
  );
}
