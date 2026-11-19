"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

/**
 * The shared chart components.
 *
 * Every chart in the app reads from the demo database through the service
 * layer, so the data is always real demo data — never a hardcoded array. The
 * colours come from the design tokens so the charts follow the light/dark
 * theme without a second palette to maintain.
 */

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export interface ChartRow {
  [key: string]: string | number;
}

interface BarSeriesChartProps {
  data: ChartRow[];
  /** The key holding the category label. */
  labelKey: string;
  /** The key holding the numeric value. */
  valueKey: string;
  /** The label of the series, shown in the tooltip. */
  seriesLabel?: string;
  height?: number;
  className?: string;
}

/** A vertical bar chart with one series. */
export function BarSeriesChart({
  data,
  labelKey,
  valueKey,
  seriesLabel,
  height = 240,
  className,
}: BarSeriesChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis
            dataKey={labelKey}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
            }}
          />
          <Bar
            dataKey={valueKey}
            name={seriesLabel ?? valueKey}
            fill={CHART_COLORS[0]}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface LineSeriesChartProps {
  data: ChartRow[];
  labelKey: string;
  valueKey: string;
  seriesLabel?: string;
  height?: number;
  className?: string;
}

/** A line chart with one series. */
export function LineSeriesChart({
  data,
  labelKey,
  valueKey,
  seriesLabel,
  height = 240,
  className,
}: LineSeriesChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis
            dataKey={labelKey}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
            }}
          />
          <Line
            type="monotone"
            dataKey={valueKey}
            name={seriesLabel ?? valueKey}
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface PieSeriesChartProps {
  data: ChartRow[];
  labelKey: string;
  valueKey: string;
  height?: number;
  className?: string;
}

/** A donut chart with one slice per row. */
export function PieSeriesChart({
  data,
  labelKey,
  valueKey,
  height = 240,
  className,
}: PieSeriesChartProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={labelKey}
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
          >
            {data.map((row, index) => (
              <Cell
                key={`${String(row[labelKey])}-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: "0.75rem" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export { CHART_COLORS };
