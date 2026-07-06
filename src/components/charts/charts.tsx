"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

const CHART_COLORS = ["#059669", "#b45309", "#334155", "#0d9488", "#a16207", "#64748b"];
const AXIS_STYLE = { fontSize: 11, fill: "#6b7280" };

function currencyTickFormatter(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return `${value}`;
}

/** Monthly P&L bar chart — green above zero, red below. */
export function MonthlyPnlChart({
  data,
  currency,
}: {
  data: { month: string; pnl: number }[];
  currency: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d5" vertical={false} />
        <XAxis dataKey="month" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          tickFormatter={currencyTickFormatter}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          formatter={(value) => [formatCurrency(Number(value), currency), "P&L"]}
        />
        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.pnl >= 0 ? "#059669" : "#dc2626"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Cumulative realized P&L equity curve. */
export function EquityCurveChart({
  data,
  currency,
}: {
  data: { date: string; equity: number }[];
  currency: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d5" vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          tickFormatter={currencyTickFormatter}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value), currency), "Equity"]}
        />
        <Line
          type="monotone"
          dataKey="equity"
          stroke="#047857"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Allocation donut (by asset type / market / sector). */
export function AllocationPie({
  data,
  currency,
}: {
  data: { key: string; value: number }[];
  currency: string;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No holdings yet
      </p>
    );
  }
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            strokeWidth={1}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              formatCurrency(Number(value), currency),
              String(name),
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <li key={d.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            {d.key}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bar chart for counts (e.g. mistake frequency). */
export function CountBarChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 40 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d5" horizontal={false} />
        <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ ...AXIS_STYLE, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={130}
        />
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="count" fill="#b45309" radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Grouped P&L bar chart (strategy / emotion performance). */
export function GroupPnlChart({
  data,
  currency,
}: {
  data: { key: string; pnl: number }[];
  currency: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d5" vertical={false} />
        <XAxis dataKey="key" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          tickFormatter={currencyTickFormatter}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          formatter={(value) => [formatCurrency(Number(value), currency), "P&L"]}
        />
        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.pnl >= 0 ? "#059669" : "#dc2626"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
