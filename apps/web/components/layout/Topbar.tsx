"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, Search, RefreshCw, Sun, Moon } from "lucide-react";
import { useSession } from "@/providers/session";
import { syncWorkspace } from "@/graphql/mutations";
import { NotificationCenter } from "./NotificationCenter";
import { Kbd } from "@/components/ui/primitives";
import { titleCase } from "@/lib/utils";

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/repositories/")) return "Repository";
  if (pathname.startsWith("/pull-requests/")) return "Pull Request";
  if (pathname.startsWith("/issues/")) return "Issue";
  const seg = pathname.split("/").filter(Boolean)[0] ?? "overview";
  return titleCase(seg);
}

export function Topbar({ onOpenMenu, openPalette }: { onOpenMenu: () => void; openPalette: () => void }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { workspace } = useSession();
  const [syncing, setSyncing] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    typeof window !== "undefined" ? (document.documentElement.classList.contains("light") ? "light" : "dark") : "dark",
  );

  const onSync = async () => {
    setSyncing(true);
    try {
      await syncWorkspace();
      await queryClient.invalidateQueries();
      setTimeout(() => setSyncing(false), 800);
    } catch {
      setSyncing(false);
    }
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    html.classList.toggle("light");
    const next = html.classList.contains("light") ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem("parallax.theme", next);
    } catch {
      /* ignore */
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 lg:px-4">
      <button className="rounded-sm p-1.5 text-muted hover:bg-raised hover:text-foreground lg:hidden" onClick={onOpenMenu} aria-label="Open navigation">
        <Menu className="h-4 w-4" />
      </button>

      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-foreground">{pageTitle(pathname)}</p>
        {workspace && <p className="hidden truncate font-mono text-[10px] text-subtle sm:block">{workspace.name}</p>}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          className="hidden items-center gap-2 rounded-sm border border-border bg-raised px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground sm:flex"
          onClick={openPalette}
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          Search…
          <Kbd>⌘K</Kbd>
        </button>

        <button
          className="rounded-sm border border-border bg-raised p-1.5 text-muted transition-colors hover:border-border-strong hover:text-foreground"
          onClick={() => void onSync()}
          disabled={syncing}
          aria-label="Sync workspace"
          title="Sync workspace"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-accent" : ""}`} />
        </button>

        <button className="rounded-sm border border-transparent p-1.5 text-muted hover:bg-raised hover:text-foreground" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
          {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        <NotificationCenter />
      </div>
    </header>
  );
}
