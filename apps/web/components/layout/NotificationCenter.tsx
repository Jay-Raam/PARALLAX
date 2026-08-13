"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CheckCheck, ShieldAlert, GitPullRequest, Rocket, HeartCrack, Package, Lightbulb, RefreshCw } from "lucide-react";
import { fetchNotifications, fetchUnreadNotificationCount } from "@/graphql/queries/recommendations";
import { markAllNotificationsRead, markNotificationRead } from "@/graphql/mutations";
import { getWsClient } from "@/lib/gql";
import { NOTIFICATION_CREATED_SUBSCRIPTION, subDoc } from "@/graphql/subscriptions";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types/graphql";

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  PR_RISK: GitPullRequest,
  SECURITY_VULNERABILITY: ShieldAlert,
  CI_FAILURE: RefreshCw,
  DEPLOYMENT_FAILURE: Rocket,
  HEALTH_DROP: HeartCrack,
  DEPENDENCY_VULNERABILITY: Package,
  RECOMMENDATION: Lightbulb,
  SYNC_COMPLETE: RefreshCw,
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications({ first: 30 }),
    placeholderData: (prev) => prev,
  });

  const { data: unread } = useQuery({
    queryKey: ["unread-count"],
    queryFn: fetchUnreadNotificationCount,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["unread-count"] });
  }, [queryClient]);

  useEffect(() => {
    if (!open) return;
    const ws = getWsClient();
    const unsub = ws.subscribe(
      { query: subDoc(NOTIFICATION_CREATED_SUBSCRIPTION) },
      {
        next: () => invalidate(),
        error: () => undefined,
        complete: () => undefined,
      },
    );
    return () => unsub();
  }, [open, invalidate]);

  const list = notifications?.edges.map((e) => e.node) ?? [];
  const unreadCount = unread ?? list.filter((n) => !n.readAt).length;

  return (
    <div className="relative">
      <button
        className="relative rounded-sm border border-transparent p-1.5 text-muted transition-colors hover:bg-raised hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="notification-center"
      >
        {unreadCount > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-mono text-[9px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-[min(380px,92vw)] overflow-hidden rounded-md border border-border-strong bg-overlay shadow-pop animate-slide-down">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <p className="text-[12px] font-semibold text-foreground">Notifications</p>
              {unreadCount > 0 && (
                <button
                  className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground"
                  onClick={() => {
                    void markAllNotificationsRead().then(invalidate);
                  }}
                >
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto scroll-thin">
              {list.length === 0 && <p className="px-3 py-10 text-center text-xs text-faint">No notifications yet</p>}
              {list.map((n: Notification) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                const unreadItem = !n.readAt;
                return (
                  <button
                    key={n.id}
                    className={cn("flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-raised", unreadItem && "bg-accent-dim/30")}
                    onClick={() => {
                      if (unreadItem) void markNotificationRead(n.id).then(invalidate);
                      if (n.url) window.location.href = n.url;
                    }}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border bg-raised text-subtle">
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[12px] leading-snug", unreadItem ? "font-medium text-foreground" : "text-muted")}>{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-[11px] leading-snug text-subtle">{n.body}</span>}
                      <span className="mt-1 block font-mono text-[10px] text-faint">{timeAgo(n.createdAt)}</span>
                    </span>
                    {unreadItem && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
