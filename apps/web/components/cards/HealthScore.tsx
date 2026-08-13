"use client";

import { cn } from "@/lib/utils";

export function healthLabel(score: number): string {
  if (score >= 85) return "HEALTHY";
  if (score >= 70) return "GOOD";
  if (score >= 55) return "NEEDS ATTENTION";
  return "AT RISK";
}

export function healthColor(score: number): string {
  if (score >= 85) return "var(--color-success)";
  if (score >= 70) return "var(--color-warning)";
  if (score >= 55) return "var(--color-warning)";
  return "var(--color-danger)";
}

export function HealthScore({
  score,
  change,
  label,
  size = "lg",
  className,
}: {
  score: number | null | undefined;
  change?: number | null;
  label?: string;
  size?: "lg" | "md";
  className?: string;
}) {
  const s = score ?? 0;
  const color = healthColor(s);
  const R = size === "lg" ? 56 : 40;
  const C = 2 * Math.PI * R;
  const offset = C - (s / 100) * C;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative" style={{ width: (R + 10) * 2, height: (R + 10) * 2 }}>
        <svg width={(R + 10) * 2} height={(R + 10) * 2} viewBox={`0 0 ${(R + 10) * 2} ${(R + 10) * 2}`} role="img" aria-label={`Health score ${s}`}>
          <circle cx={R + 10} cy={R + 10} r={R} fill="none" stroke="var(--color-raised)" strokeWidth={size === "lg" ? 7 : 6} />
          <circle
            cx={R + 10}
            cy={R + 10}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={size === "lg" ? 7 : 6}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${R + 10} ${R + 10})`}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-mono font-semibold leading-none", size === "lg" ? "text-4xl" : "text-2xl")}>{s}</span>
          <span className={cn("mt-0.5 font-mono text-[10px] uppercase tracking-wider", size === "lg" ? "" : "hidden")} style={{ color }}>
            {label ?? healthLabel(s)}
          </span>
        </div>
      </div>
      {change !== null && change !== undefined && (
        <div className="space-y-0.5">
          <p className="font-mono text-[13px] text-muted">
            {change > 0 ? "+" : ""}
            {change} this week
          </p>
          <p className={cn("text-[11px]", change > 0 ? "text-success" : change < 0 ? "text-danger" : "text-faint")}>
            {change > 0 ? "Improving" : change < 0 ? "Declining" : "Stable"}
          </p>
        </div>
      )}
    </div>
  );
}
