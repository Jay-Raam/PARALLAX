"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Button ─────────────────────────────────────────────── */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "outline", size = "md", loading = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn("btn", variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : variant === "ghost" ? "btn-ghost" : "btn-outline", size === "sm" ? "btn-sm" : "btn-md", className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ── Badge ──────────────────────────────────────────────── */

export type BadgeTone = "default" | "accent" | "success" | "warning" | "danger" | "info" | "muted";

const badgeTones: Record<BadgeTone, string> = {
  default: "bg-raised text-muted border-border-strong",
  accent: "bg-accent-dim text-accent border-accent/30",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  info: "bg-info/10 text-info border-info/30",
  muted: "bg-transparent text-subtle border-border",
};

export function Badge({
  tone = "default",
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-xs border px-1.5 py-[2px] text-[11px] font-medium leading-none whitespace-nowrap", badgeTones[tone], className)}
      {...rest}
    >
      {children}
    </span>
  );
}

/* ── Input ──────────────────────────────────────────────── */

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn("input", className)} {...rest} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn("input min-h-24 resize-y", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cn("input cursor-pointer appearance-none pr-7 bg-no-repeat", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2370757f' fill='none' stroke-width='1.5'/%3E%3C/svg%3E\")", backgroundPosition: "right 8px center" }} {...rest}>
      {children}
    </select>
  );
});

/* ── Kbd ────────────────────────────────────────────────── */

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("kbd", className)}>{children}</kbd>;
}

/* ── Spinner / Skeleton / Progress ──────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-accent", className)} aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-raised", className)} />;
}

export function ProgressBar({ value, className, tone = "accent" }: { value: number; className?: string; tone?: "accent" | "success" | "warning" | "danger" }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-danger" : "bg-accent";
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-raised", className)} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all duration-300", color)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/* ── Card / Panel ───────────────────────────────────────── */

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-border px-4 py-3", className)}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex" tabIndex={0} role="tooltip">
      {children}
      <span className="pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-sm border border-border bg-overlay px-2 py-1 text-[11px] text-foreground opacity-0 shadow-pop transition-opacity duration-100 group-hover/tooltip:opacity-100" style={{ transitionProperty: "opacity" }}>
        {label}
      </span>
    </span>
  );
}

/* ── Page header ────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
