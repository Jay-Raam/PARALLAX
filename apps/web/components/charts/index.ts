export const CHART_COLORS = {
  brass: "#c9a35f",
  blue: "#7db7f5",
  amber: "#fbbf24",
  emerald: "#34d399",
  rose: "#fb7185",
  violet: "#a78bfa",
  lime: "#a3e635",
  orange: "#fb923c",
} as const;

export const PALETTE = Object.values(CHART_COLORS);

export const AXIS_STYLE = {
  fontSize: 11,
  fill: "#747b84",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export const GRID_STYLE = {
  stroke: "#1e232b",
  strokeDasharray: "3 3",
} as const;

export const TOOLTIP_STYLE: React.CSSProperties = {
  background: "#1b2029",
  border: "1px solid #2e3540",
  borderRadius: 4,
  fontSize: 12,
  color: "#e8e9e6",
  boxShadow: "0 8px 28px rgb(0 0 0 / 0.55)",
};

export function formatTickMs(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}
