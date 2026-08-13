"use client";

import { Tag, Zap, Bug, AlertTriangle, Package } from "lucide-react";
import type { Release } from "@/types/graphql";
import { Badge } from "@/components/ui/primitives";
import { timeAgo } from "@/lib/utils";

export function ReleaseCard({ release }: { release: Release }) {
  const h = release.health;
  return (
    <div className="panel panel-interactive p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-border bg-raised text-accent">
              <Tag className="h-3.5 w-3.5" />
            </span>
            <h3 className="font-mono text-[14px] font-semibold text-foreground">{release.tagName}</h3>
            {release.isPrerelease && <Badge tone="warning">PRERELEASE</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted">
            {release.name ?? release.tagName} · by {release.authorLogin} · {timeAgo(release.publishedAt)}
            {release.repository && <span className="font-mono text-[11px] text-subtle"> · {release.repository.name}</span>}
          </p>
        </div>
        {h && (
          <div className="text-right">
            <p className="font-mono text-2xl font-semibold" style={{ color: h.score >= 80 ? "var(--color-success)" : h.score >= 60 ? "var(--color-warning)" : "var(--color-danger)" }}>
              {h.score}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-subtle">release health</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span className="flex items-center gap-1 rounded-sm border border-border bg-raised px-1.5 py-0.5 text-muted">
          <Zap className="h-3 w-3 text-accent" /> {release.features.length} features
        </span>
        <span className="flex items-center gap-1 rounded-sm border border-border bg-raised px-1.5 py-0.5 text-muted">
          <Bug className="h-3 w-3 text-success" /> {release.bugFixes.length} fixes
        </span>
        <span className="flex items-center gap-1 rounded-sm border border-border bg-raised px-1.5 py-0.5 text-muted">
          <AlertTriangle className="h-3 w-3 text-danger" /> {release.breakingChanges.length} breaking
        </span>
        <span className="flex items-center gap-1 rounded-sm border border-border bg-raised px-1.5 py-0.5 text-muted">
          <Package className="h-3 w-3 text-warning" /> {release.dependencyChanges.length} dependency changes
        </span>
        <span className="rounded-sm border border-border bg-raised px-1.5 py-0.5 font-mono text-[10.5px] text-muted">{release.commitCount} commits</span>
      </div>

      {release.body && <p className="mt-3 line-clamp-2 border-t border-border pt-3 text-xs text-muted">{release.body}</p>}
    </div>
  );
}
