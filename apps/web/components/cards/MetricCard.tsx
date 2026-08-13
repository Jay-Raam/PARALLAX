"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  icon?: LucideIcon;
  href?: string;
  tone?: "default" | "accent" | "danger" | "success" | "warning";
}) {
  const deltaTone = delta === null || delta === undefined ? null : delta > 0 ? (tone === "danger" ? "danger" : "success") : delta < 0 ? (tone === "danger" ? "success" : "danger") : null;

  const inner = (
    <div className="group flex items-start justify-between gap-2 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-subtle">{label}</p>
        <p className={cn("mt-1 font-mono text-[22px] leading-none font-semibold tracking-tight", tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "accent" ? "text-accent" : "text-foreground")}>
          {value}
        </p>
        {(delta !== null && delta !== undefined) || deltaLabel ? (
          <p className="mt-1.5 flex items-center gap-1 text-[11px]">
            {delta !== null && delta !== undefined && delta !== 0 && (
              <span className={cn("flex items-center font-mono", deltaTone === "danger" ? "text-danger" : deltaTone === "success" ? "text-success" : "text-muted")}>
                {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(delta)}
              </span>
            )}
            {deltaLabel && <span className="text-faint">{deltaLabel}</span>}
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-faint">&nbsp;</p>
        )}
      </div>
      {Icon && (
        <div className="rounded-sm border border-border bg-raised p-1.5 text-subtle transition-colors group-hover:text-accent">
          <Icon className="h-4 w-4" />
        </div>
      )}
    </div>
  );

  const cls = "panel panel-interactive block h-full";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
