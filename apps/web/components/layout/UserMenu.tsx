"use client";

import { useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { useSession } from "@/providers/session";
import { initials } from "@/lib/utils";

export function UserMenu() {
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <div className="relative mt-2">
      <button
        className="flex w-full items-center gap-2 rounded-sm border border-border bg-raised px-2 py-1.5 text-left transition-colors hover:border-border-strong"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="user-menu"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-5 w-5 rounded-full border border-border" />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-dim font-mono text-[9px] text-accent">
            {initials(user.name)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-foreground">{user.name}</span>
          {user.githubLogin && <span className="block truncate font-mono text-[10px] text-subtle">@{user.githubLogin}</span>}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-md border border-border-strong bg-overlay shadow-pop animate-slide-down">
            <div className="border-b border-border px-2.5 py-2">
              <p className="truncate text-[12px] font-medium text-foreground">{user.name}</p>
              <p className="truncate font-mono text-[10px] text-subtle">{user.email}</p>
            </div>
            <button
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] text-muted hover:bg-raised hover:text-foreground"
              onClick={() => {
                setOpen(false);
                window.location.href = "/settings?tab=profile";
              }}
            >
              <UserRound className="h-3.5 w-3.5" /> Profile settings
            </button>
            <button
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] text-danger hover:bg-danger/10"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
