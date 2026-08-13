"use client";

import { GitCommitHorizontal, GitPullRequest, CircleDot, Rocket, Tag, ShieldAlert, RefreshCw, CheckCircle2 } from "lucide-react";
import type { ActivityFilter, ActivityItem } from "@/types/graphql";
import { formatTime, timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  COMMITS: { icon: GitCommitHorizontal, color: "text-info" },
  PRS: { icon: GitPullRequest, color: "text-accent" },
  REVIEWS: { icon: CheckCircle2, color: "text-violet-400" },
  ISSUES: { icon: CircleDot, color: "text-warning" },
  DEPLOYMENTS: { icon: Rocket, color: "text-success" },
  RELEASES: { icon: Tag, color: "text-chart-7" },
  SECURITY: { icon: ShieldAlert, color: "text-danger" },
  CI: { icon: RefreshCw, color: "text-muted" },
};

export function activityIcon(type: ActivityFilter) {
  const meta = TYPE_META[type] ?? TYPE_META.CI;
  const Icon = meta.icon;
  return <Icon className={cn("h-3.5 w-3.5", meta.color)} />;
}

export function ActivityTimeline({
  items,
  showTime = false,
  limit,
}: {
  items: ActivityItem[];
  showTime?: boolean;
  limit?: number;
}) {
  const list = limit ? items.slice(0, limit) : items;
  if (!list.length) return <p className="px-4 py-8 text-center text-xs text-muted">No activity yet.</p>;
  return (
    <ol className="relative space-y-0">
      {list.map((item, i) => (
        <li key={item.id} className="relative flex gap-3 px-4 py-2.5">
          {i < list.length - 1 && <span className="absolute left-[26px] top-9 bottom-0 w-px bg-border" aria-hidden />}
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border bg-raised">
            {activityIcon(item.type)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[13px] text-foreground">
                {item.repositoryName && <span className="mr-1.5 font-mono text-[11px] text-accent">{item.repositoryName}</span>}
                {item.title}
              </p>
              <span className="shrink-0 font-mono text-[11px] text-faint">{showTime ? formatTime(item.at) : timeAgo(item.at)}</span>
            </div>
            {item.subtitle && <p className="mt-0.5 truncate text-xs text-muted">{item.subtitle}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
