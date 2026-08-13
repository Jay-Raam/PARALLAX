"use client";

import Link from "next/link";
import { GitFork, GitPullRequest, CircleDot, Rocket, Lock } from "lucide-react";
import type { Repository } from "@/types/graphql";
import { HealthBadge, SyncStatusBadge } from "@/components/ui/badges";
import { formatNumber, timeAgo } from "@/lib/utils";

export function RepositoryCard({ repo }: { repo: Repository }) {
  const health = repo.health?.overall;
  return (
    <Link
      href={`/repositories/${repo.id}`}
      className="panel panel-interactive group block p-4"
      data-testid="repository-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {repo.isPrivate && <Lock className="h-3 w-3 text-subtle" aria-label="private" />}
            <h3 className="truncate font-mono text-[14px] font-semibold tracking-tight text-foreground group-hover:text-accent">
              {repo.name}
            </h3>
          </div>
          {repo.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{repo.description}</p>}
        </div>
        <HealthBadge score={health} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {repo.language && (
          <span className="rounded-sm border border-border bg-raised px-1.5 py-0.5 font-mono text-[10.5px] text-muted">{repo.language}</span>
        )}
        {repo.techStack.slice(0, 4).map((t) => (
          <span key={t} className="rounded-sm border border-border bg-raised px-1.5 py-0.5 font-mono text-[10.5px] text-muted">
            {t}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-border pt-2.5 text-[11px] text-subtle">
        <span className="flex items-center gap-1">
          <GitPullRequest className="h-3 w-3" /> {formatNumber(repo.counts?.openPrs)} open
        </span>
        <span className="flex items-center gap-1">
          <CircleDot className="h-3 w-3" /> {formatNumber(repo.counts?.openIssues)}
        </span>
        <span className="flex items-center gap-1">
          <Rocket className="h-3 w-3" /> {formatNumber(repo.counts?.deployments)}
        </span>
        <span className="flex items-center gap-1">
          <GitFork className="h-3 w-3" /> {formatNumber(repo.forkCount)}
        </span>
        <span className="ml-auto text-faint">activity {timeAgo(repo.lastActivityAt)}</span>
        <SyncStatusBadge status={repo.syncStatus} />
      </div>
    </Link>
  );
}
