"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from "recharts";
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, PALETTE } from "./index";

export function Bars({
  data,
  dataKey,
  name,
  height = 220,
  color = PALETTE[0],
  formatValue = (v: number) => String(v),
  xTickFormatter,
}: {
  data: Array<Record<string, string | number | null>>;
  dataKey: string;
  name: string;
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
  xTickFormatter?: (v: string) => string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray={GRID_STYLE.strokeDasharray} stroke={GRID_STYLE.stroke} vertical={false} />
          <XAxis dataKey="name" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: GRID_STYLE.stroke }} tickFormatter={xTickFormatter} interval={0} />
          <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(34,211,238,0.06)" }} formatter={(value) => [formatValue(Number(value)), name]} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[2, 2, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Simple horizontal distribution bars, no chart lib needed. */
export function HBarList({
  items,
  formatValue = (v: number) => String(v),
}: {
  items: Array<{ label: string; value: number; color?: string }>;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-xs text-muted">{i.label}</span>
            <span className="font-mono text-xs text-foreground">{formatValue(i.value)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? "var(--color-accent)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export { LabelList };
