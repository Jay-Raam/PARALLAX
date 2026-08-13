"use client";

import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button, Card, Skeleton } from "./primitives";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 px-6 py-12 text-center ${className ?? ""}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-raised text-subtle">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="mt-1 text-[13px] font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this data",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-danger/30 bg-danger/10 text-danger">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </Card>
  );
}

export function LoadingRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? "w-1/4" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-56" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
