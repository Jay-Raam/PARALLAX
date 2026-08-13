"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, formatTickMs } from "./index";

export interface TrendSeriesPoint {
  date: string;
  [key: string]: string | number | null;
}

export function TrendChart({
  data,
  series,
  height = 220,
  formatValue = (v: number) => String(v),
  yTickFormatter,
  xTickFormatter,
}: {
  data: TrendSeriesPoint[];
  series: Array<{ key: string; name: string; color: string }>;
  height?: number;
  formatValue?: (v: number) => string;
  yTickFormatter?: (v: number) => string;
  xTickFormatter?: (v: string) => string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray={GRID_STYLE.strokeDasharray} stroke={GRID_STYLE.stroke} vertical={false} />
          <XAxis
            dataKey="date"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: GRID_STYLE.stroke }}
            tickFormatter={xTickFormatter}
            minTickGap={28}
          />
          <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={yTickFormatter} width={44} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [formatValue(Number(value)), name as string]}
            labelFormatter={(label) => String(label)}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={1.5}
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineTrendChart({
  data,
  series,
  height = 220,
  formatValue = (v: number) => String(v),
  yTickFormatter,
  xTickFormatter,
}: {
  data: TrendSeriesPoint[];
  series: Array<{ key: string; name: string; color: string }>;
  height?: number;
  formatValue?: (v: number) => string;
  yTickFormatter?: (v: number) => string;
  xTickFormatter?: (v: string) => string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray={GRID_STYLE.strokeDasharray} stroke={GRID_STYLE.stroke} vertical={false} />
          <XAxis dataKey="date" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: GRID_STYLE.stroke }} tickFormatter={xTickFormatter} minTickGap={28} />
          <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickFormatter={yTickFormatter} width={44} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [formatValue(Number(value)), name as string]} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function formatMsTicks(v: number): string {
  return formatTickMs(v);
}
