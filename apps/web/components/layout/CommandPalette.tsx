"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  FolderGit2,
  GitPullRequest,
  CircleDot,
  Package,
  ShieldCheck,
  Workflow,
  Users,
  Lightbulb,
  ArrowRight,
  CornerDownLeft,
  RefreshCw,
  Sun,
  LayoutDashboard,
  BarChart3,
  Activity,
  Tag,
  Settings,
  GitCommitHorizontal,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useHotkey } from "@/hooks/useHotkey";
import { fetchSearch } from "@/graphql/queries/activity";
import { syncWorkspace } from "@/graphql/mutations";
import type { SearchResults } from "@/types/graphql";
import { cn } from "@/lib/utils";

type RouterLike = ReturnType<typeof useRouter>;
type QueryClientLike = ReturnType<typeof useQueryClient>;

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: (router: RouterLike, queryClient: QueryClientLike) => void;
}

const COMMANDS: PaletteItem[] = [
  { id: "cmd-overview", group: "Navigate", label: "Go to Overview", icon: LayoutDashboard, run: (r) => r.push("/overview") },
  { id: "cmd-repos", group: "Navigate", label: "Go to Repositories", icon: FolderGit2, run: (r) => r.push("/repositories") },
  { id: "cmd-prs", group: "Navigate", label: "Open Pull Requests", icon: GitPullRequest, run: (r) => r.push("/pull-requests") },
  { id: "cmd-issues", group: "Navigate", label: "Open Issues", icon: CircleDot, run: (r) => r.push("/issues") },
  { id: "cmd-deps", group: "Navigate", label: "Open Dependencies", icon: Package, run: (r) => r.push("/dependencies") },
  { id: "cmd-security", group: "Navigate", label: "Open Security", icon: ShieldCheck, run: (r) => r.push("/security") },
  { id: "cmd-cicd", group: "Navigate", label: "Open CI/CD", icon: Workflow, run: (r) => r.push("/cicd") },
  { id: "cmd-analytics", group: "Navigate", label: "Open Analytics", icon: BarChart3, run: (r) => r.push("/analytics") },
  { id: "cmd-recs", group: "Navigate", label: "Open Recommendations", icon: Lightbulb, run: (r) => r.push("/recommendations") },
  { id: "cmd-activity", group: "Navigate", label: "Open Activity", icon: Activity, run: (r) => r.push("/activity") },
  { id: "cmd-releases", group: "Navigate", label: "Open Releases", icon: Tag, run: (r) => r.push("/releases") },
  { id: "cmd-contributors", group: "Navigate", label: "Open Contributors", icon: Users, run: (r) => r.push("/contributors") },
  { id: "cmd-settings", group: "Navigate", label: "Open Settings", icon: Settings, run: (r) => r.push("/settings") },
  { id: "cmd-sync", group: "Actions", label: "Sync Workspace", sublabel: "Queue a background sync for all repositories", icon: RefreshCw, run: () => void syncWorkspace() },
  { id: "cmd-theme", group: "Actions", label: "Toggle Theme", icon: Sun, run: () => toggleTheme() },
  { id: "cmd-refresh", group: "Actions", label: "Refresh Data", icon: RefreshCw, run: (_, qc) => qc.invalidateQueries() },
];

function toggleTheme() {
  const html = document.documentElement;
  html.classList.toggle("light");
  try {
    window.localStorage.setItem("parallax.theme", html.classList.contains("light") ? "light" : "dark");
  } catch {
    /* ignore */
  }
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounce(query, 250);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !debounced.trim()) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    fetchSearch(debounced.trim(), 5)
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch(() => {
        if (!cancelled) setResults(null);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    const out: PaletteItem[] = [];
    if (results) {
      results.repositories.forEach((r) =>
        out.push({
          id: `repo-${r.id}`,
          group: "Repositories",
          label: r.name,
          sublabel: r.language ?? undefined,
          icon: FolderGit2,
          run: () => router.push(`/repositories/${r.id}`),
        }),
      );
      results.pullRequests.forEach((p) =>
        out.push({
          id: `pr-${p.id}`,
          group: "Pull Requests",
          label: `#${p.githubNumber} ${p.title}`,
          sublabel: p.repository?.name,
          icon: GitPullRequest,
          run: () => router.push(`/pull-requests/${p.id}`),
        }),
      );
      results.issues.forEach((i) =>
        out.push({
          id: `issue-${i.id}`,
          group: "Issues",
          label: `#${i.githubNumber} ${i.title}`,
          sublabel: i.repository?.name,
          icon: CircleDot,
          run: () => router.push(`/issues/${i.id}`),
        }),
      );
      results.commits.forEach((c) =>
        out.push({
          id: `commit-${c.id}`,
          group: "Commits",
          label: c.messageTitle,
          sublabel: `${c.authorLogin} · ${c.repository?.name}`,
          icon: GitCommitHorizontal,
          run: () => router.push(c.repository ? `/repositories/${c.repository.id}` : "/activity"),
        }),
      );
      results.dependencies.forEach((d) =>
        out.push({
          id: `dep-${d.id}`,
          group: "Dependencies",
          label: `${d.name} ${d.currentVersion} → ${d.latestVersion ?? "?"}`,
          sublabel: d.ecosystem,
          icon: Package,
          run: () => router.push("/dependencies"),
        }),
      );
      results.contributors.forEach((c) =>
        out.push({
          id: `contrib-${c.id}`,
          group: "Contributors",
          label: c.login,
          sublabel: `${c.commits} commits`,
          icon: Users,
          run: () => router.push("/contributors"),
        }),
      );
      results.recommendations.forEach((rec) =>
        out.push({
          id: `rec-${rec.id}`,
          group: "Recommendations",
          label: rec.title,
          sublabel: rec.type,
          icon: Lightbulb,
          run: () => router.push("/recommendations"),
        }),
      );
    }
    return out;
  }, [query, results, router]);

  useEffect(() => setActive(0), [query, results]);

  const run = (item: PaletteItem) => {
    item.run(router, queryClient);
    onClose();
  };

  useHotkey(
    ["mod", "k"],
    (e) => {
      e.preventDefault();
      if (open) onClose();
      else {
        /* handled in AppShell via context */
      }
    },
    false,
  );

  const groups = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    items.forEach((i) => {
      map.set(i.group, [...(map.get(i.group) ?? []), i]);
    });
    return [...map.entries()];
  }, [items]);

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="relative w-full max-w-xl overflow-hidden rounded-md border border-border-strong bg-overlay shadow-pop"
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-subtle" />
              <input
                ref={inputRef}
                className="w-full bg-transparent py-3 text-[14px] text-foreground placeholder:text-faint focus:outline-none"
                placeholder="Search repositories, PRs, issues… or type a command"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, items.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    const item = items[active];
                    if (item) run(item);
                  } else if (e.key === "Escape") {
                    onClose();
                  }
                }}
                aria-label="Search"
              />
              {searching && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-strong border-t-accent" />}
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-1.5 scroll-thin">
              {items.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-faint">No results for “{query}”</p>
              ) : (
                groups.map(([group, groupItems]) => (
                  <div key={group} className="mb-1">
                    <p className="px-2.5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-faint">{group}</p>
                    {groupItems.map((item) => {
                      flatIndex += 1;
                      const idx = flatIndex;
                      const Icon = item.icon;
                      const isActive = idx === active;
                      return (
                        <button
                          key={item.id}
                          className={cn("flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left", isActive ? "bg-raised text-foreground" : "text-muted")}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => run(item)}
                          aria-selected={isActive}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-accent" : "text-subtle")} />
                          <span className="min-w-0 flex-1 truncate text-[13px]">{item.label}</span>
                          {item.sublabel && <span className="truncate font-mono text-[10.5px] text-faint">{item.sublabel}</span>}
                          {isActive && <CornerDownLeft className="h-3 w-3 shrink-0 text-faint" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[10.5px] text-faint">
              <span className="flex items-center gap-1"><kbd className="kbd">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="kbd">↵</kbd> select</span>
              <span className="flex items-center gap-1"><kbd className="kbd">esc</kbd> close</span>
              <span className="ml-auto flex items-center gap-1"><ArrowRight className="h-3 w-3" /> results from backend search</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
