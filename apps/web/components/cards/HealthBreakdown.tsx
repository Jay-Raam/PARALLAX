"use client";

import { cn } from "@/lib/utils";
import type { HealthCategory } from "@/types/graphql";

export function categoryColor(score: number): string {
  if (score >= 80) return "var(--color-success)";
  if (score >= 60) return "var(--color-warning)";
  return "var(--color-danger)";
}

export function HealthBreakdown({
  breakdown,
  compact = false,
}: {
  breakdown: HealthCategory[];
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-x-6 gap-y-2.5", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
      {breakdown.map((c) => (
        <div key={c.key} className="flex items-center gap-3">
          <span className={cn("w-32 shrink-0 truncate text-xs", compact ? "" : "text-muted")}>{c.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.score}%`, background: categoryColor(c.score) }} />
          </div>
          <span className="w-8 text-right font-mono text-xs text-foreground">{c.score}</span>
        </div>
      ))}
    </div>
  );
}
