"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Table({ className, children, ...rest }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left" {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children, className }: { children: React.ReactNode; className?: string }) {
  return <thead className={cn("border-b border-border bg-surface", className)}>{children}</thead>;
}

export function TBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tbody className={cn("divide-y divide-border", className)}>{children}</tbody>;
}

export function Th({ children, className, align }: { children?: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return <th className={cn("th", align === "right" ? "text-right" : align === "center" ? "text-center" : "", className)}>{children}</th>;
}

export function Td({ children, className, align }: { children?: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return <td className={cn("td", align === "right" ? "text-right" : align === "center" ? "text-center" : "", className)}>{children}</td>;
}

export function Tr({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr className={cn(onClick ? "cursor-pointer" : "", className)} onClick={onClick}>
      {children}
    </tr>
  );
}

export function SortHeader({
  label,
  sortKey,
  activeSort,
  onSort,
  align,
}: {
  label: string;
  sortKey: string;
  activeSort?: { key: string; dir: "asc" | "desc" } | null;
  onSort?: (key: string) => void;
  align?: "left" | "right";
}) {
  const isActive = activeSort?.key === sortKey;
  return (
    <Th align={align}>
      {onSort ? (
        <button
          className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground"
          onClick={() => onSort(sortKey)}
          aria-label={`Sort by ${label}`}
        >
          {label}
          {isActive ? (activeSort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </button>
      ) : (
        label
      )}
    </Th>
  );
}
