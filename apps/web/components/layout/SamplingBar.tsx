"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/providers/session";

function clock(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

/**
 * Signature element — the instrument's sampling bar.
 * A hairline-ruled readout strip, like a surveyor's log: live "sampling"
 * indicator, the workspace under observation, and the current health reading.
 */
export function SamplingBar() {
  const { workspace, user } = useSession();
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    setNow(clock());
    const t = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(t);
  }, []);

  const health = workspace?.health;
  const healthTone =
    health == null ? "text-faint" : health >= 75 ? "text-success" : health >= 50 ? "text-warning" : "text-danger";

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-3 overflow-hidden border-b border-border bg-background px-3 font-mono text-[10px] tracking-wide lg:px-4"
      role="status"
      aria-label="Live sampling readout"
    >
      <span className="flex shrink-0 items-center gap-1.5 text-subtle">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        SAMPLING
      </span>

      <span className="hidden h-3 w-px bg-border-strong sm:block" aria-hidden />

      <span className="hidden min-w-0 items-center gap-1.5 sm:flex">
        <span className="text-faint">SCOPE</span>
        <span className="truncate text-foreground">{workspace?.name ?? "—"}</span>
      </span>

      <span className="hidden h-3 w-px bg-border-strong md:block" aria-hidden />

      <span className="hidden items-center gap-1.5 md:flex">
        <span className="text-faint">HEALTH</span>
        <span className={`tabular-nums ${healthTone}`}>{health == null ? "—" : `${health}/100`}</span>
      </span>

      {user?.name && (
        <>
          <span className="hidden h-3 w-px bg-border-strong lg:block" aria-hidden />
          <span className="hidden items-center gap-1.5 lg:flex">
            <span className="text-faint">OBSERVER</span>
            <span className="truncate text-muted">{user.name}</span>
          </span>
        </>
      )}

      <span className="ml-auto hidden items-center gap-1.5 sm:flex">
        <span className="text-faint">UTC</span>
        <span className="tabular-nums text-muted">{now}</span>
      </span>

      {/* graticule ticks — the instrument's measuring scale */}
      <div className="flex items-end gap-[3px]" aria-hidden>
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className={`block w-px ${i % 5 === 4 ? "h-2 bg-border-strong" : "h-1 bg-border"}`}
          />
        ))}
      </div>
    </div>
  );
}
