"use client";

import Link from "next/link";
import { Check, X, Lightbulb } from "lucide-react";
import type { Recommendation } from "@/types/graphql";
import { Card } from "@/components/ui/primitives";
import { PriorityBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

function evidenceRows(recommendation: Recommendation): Array<[string, string]> {
  const e = recommendation.evidence as Record<string, unknown> | null;
  if (!e) return [];
  return Object.entries(e)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => [k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), typeof v === "object" ? JSON.stringify(v) : String(v)]);
}

export function RecommendationCard({
  recommendation,
  onComplete,
  onDismiss,
  compact = false,
}: {
  recommendation: Recommendation;
  onComplete?: (id: string) => void;
  onDismiss?: (id: string) => void;
  compact?: boolean;
}) {
  const rows = evidenceRows(recommendation);
  return (
    <Card className={cn("flex flex-col", compact ? "p-3.5" : "p-4")} data-testid="recommendation-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={recommendation.priority} />
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-subtle">{recommendation.type.replace(/_/g, " ")}</span>
          </div>
          <h3 className="mt-1.5 text-[13px] font-semibold leading-snug text-foreground">
            <Link href={recommendation.repository ? `/repositories/${recommendation.repository.id}` : "/recommendations"} className="hover:text-accent">
              {recommendation.title}
            </Link>
          </h3>
          {recommendation.repository && (
            <p className="mt-0.5 font-mono text-[11px] text-accent">{recommendation.repository.name}</p>
          )}
        </div>
        <Lightbulb className={cn("h-4 w-4 shrink-0", recommendation.priority === "HIGH" || recommendation.priority === "CRITICAL" ? "text-warning" : "text-accent")} />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted">{recommendation.reason}</p>

      {rows.length > 0 && !compact && (
        <dl className="mt-3 grid gap-x-4 gap-y-1.5 rounded-sm border border-border bg-raised/50 p-3 sm:grid-cols-2">
          {rows.slice(0, 6).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[10px] uppercase tracking-wider text-faint">{k}</dt>
              <dd className="truncate font-mono text-xs text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {recommendation.suggestedAction && !compact && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
          <span className="mt-px font-medium text-accent">Action:</span>
          <span>{recommendation.suggestedAction}</span>
        </p>
      )}

      {recommendation.impact && <p className="mt-1.5 text-[11px] text-subtle">Impact: {recommendation.impact}</p>}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <span className="font-mono text-[10.5px] text-faint">{formatDate(recommendation.createdAt)}</span>
        {recommendation.status === "ACTIVE" && (onComplete || onDismiss) && (
          <div className="flex gap-1.5">
            {onComplete && (
              <Button variant="ghost" size="sm" onClick={() => onComplete(recommendation.id)} className="text-success hover:bg-success/10">
                <Check className="h-3.5 w-3.5" /> Complete
              </Button>
            )}
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={() => onDismiss(recommendation.id)} className="text-subtle hover:bg-raised">
                <X className="h-3.5 w-3.5" /> Dismiss
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
