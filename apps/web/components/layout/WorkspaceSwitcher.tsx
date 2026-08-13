"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Building2 } from "lucide-react";
import { useSession } from "@/providers/session";
import { createWorkspace } from "@/graphql/mutations";
import { Button, Input } from "@/components/ui/primitives";
import { Dialog as DialogOverlay } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher() {
  const { workspace, workspaces, switchWorkspace, refresh } = useSession();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createWorkspace(name.trim());
      await refresh();
      setCreateOpen(false);
      setName("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          className="flex w-full items-center gap-2 rounded-sm border border-border bg-raised px-2 py-1.5 text-left transition-colors hover:border-border-strong"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-testid="workspace-switcher"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xs bg-accent-dim text-accent">
            <Building2 className="h-3 w-3" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-foreground">{workspace?.name ?? "Select workspace"}</span>
            <span className="block truncate font-mono text-[10px] text-subtle">{workspace?.slug}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-faint" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border-strong bg-overlay shadow-pop animate-slide-down">
              <p className="px-2.5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-faint">Workspaces</p>
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  role="option"
                  aria-selected={w.id === workspace?.id}
                  className={cn("flex w-full items-center gap-2 px-2.5 py-2 text-left text-[13px] hover:bg-raised", w.id === workspace?.id ? "text-foreground" : "text-muted")}
                  onClick={() => {
                    if (w.id !== workspace?.id) void switchWorkspace(w.id).then(refresh);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  {w.id === workspace?.id && <Check className="h-3.5 w-3.5 text-accent" />}
                </button>
              ))}
              <div className="border-t border-border p-1">
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-muted hover:bg-raised hover:text-foreground"
                  onClick={() => {
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> New workspace
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <DialogOverlay open={createOpen} onClose={() => setCreateOpen(false)} title="Create workspace">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onCreate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="label" htmlFor="ws-name">Workspace name</label>
            <Input id="ws-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Engineering" autoFocus />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={busy} disabled={!name.trim()}>Create</Button>
          </div>
        </form>
      </DialogOverlay>
    </>
  );
}
