"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FolderGit2, Search } from "lucide-react";
import { fetchRepositories } from "@/graphql/queries/repositories";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function RepoSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["repositories", "switcher"],
    queryFn: () => fetchRepositories(undefined, { first: 50 }),
    placeholderData: (prev) => prev,
  });

  const repos = useMemo(() => {
    const list = data?.edges.map((e) => e.node) ?? [];
    if (!q) return list;
    const needle = q.toLowerCase();
    return list.filter((r) => r.name.toLowerCase().includes(needle) || (r.description ?? "").toLowerCase().includes(needle));
  }, [data, q]);

  return (
    <div className="relative">
      <button
        className="flex w-full items-center gap-2 rounded-sm border border-border bg-raised px-2 py-1.5 text-left transition-colors hover:border-border-strong"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="repo-switcher"
      >
        <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-subtle" />
        <span className="truncate text-[12px] text-muted">{data?.totalCount ? `${data.totalCount} repositories` : "Repositories"}</span>
        <span className="ml-auto font-mono text-[10px] text-faint">{data?.totalCount ?? "—"}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border-strong bg-overlay shadow-pop animate-slide-down">
            <div className="relative border-b border-border p-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" />
              <Input className="pl-7 py-1 text-xs" placeholder="Filter repositories…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Filter repositories" />
            </div>
            <div className="max-h-64 overflow-y-auto p-1 scroll-thin">
              {repos.length === 0 && <p className="px-2 py-3 text-center text-xs text-faint">No repositories</p>}
              {repos.map((r) => (
                <button
                  key={r.id}
                  role="option"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] text-muted hover:bg-raised hover:text-foreground"
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                    router.push(`/repositories/${r.id}`);
                  }}
                >
                  <FolderGit2 className="h-3 w-3 shrink-0 text-faint" />
                  <span className="truncate font-mono">{r.name}</span>
                  <span className={cn("ml-auto h-1.5 w-1.5 shrink-0 rounded-full", (r.health?.overall ?? 0) >= 80 ? "bg-success" : (r.health?.overall ?? 0) >= 60 ? "bg-warning" : "bg-danger")} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
