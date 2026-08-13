"use client";

import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  tabClassName,
}: {
  tabs: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
  tabClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto border-b border-border", className)} role="tablist">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground",
              tabClassName,
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("rounded-sm px-1 font-mono text-[10.5px]", active ? "bg-accent-dim text-accent" : "bg-raised text-subtle")}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
