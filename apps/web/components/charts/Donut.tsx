"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { PALETTE, TOOLTIP_STYLE } from "./index";

export function Donut({
  data,
  size = 180,
  centerLabel,
  centerValue,
  formatValue = (v: number) => String(v),
}: {
  data: Array<{ name: string; value: number }>;
  size?: number;
  centerLabel?: string;
  centerValue?: string | number;
  formatValue?: (v: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatValue(Number(value)), "count"]} />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue !== undefined) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue !== undefined && <span className="font-mono text-xl font-semibold text-foreground">{centerValue}</span>}
          {centerLabel && <span className="text-[11px] uppercase tracking-wider text-subtle">{centerLabel}</span>}
          {total > 0 && <span className="mt-0.5 font-mono text-[10px] text-faint">of {total}</span>}
        </div>
      )}
    </div>
  );
}
