"use client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { YearlyProjection } from "@/types";
import { formatPct } from "@/lib/utils";

export function FFPProjectionChart({
  projections,
}: {
  projections: YearlyProjection[];
}) {
  const data = projections.map((p) => ({
    year: p.year,
    ratio: +(p.squad_cost_ratio * 100).toFixed(1),
    wage: +(p.wage_bill / 1e6).toFixed(1),
    revenue: +(p.revenue / 1e6).toFixed(1),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ratioGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="year"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="%"
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 8,
          }}
          labelStyle={{ color: "#94a3b8" }}
          itemStyle={{ color: "#3b82f6" }}
          formatter={(v) => [`${v}%`, "Squad Cost Ratio"]}
        />
        <ReferenceLine
          y={70}
          stroke="#ef4444"
          strokeDasharray="4 4"
          label={{ value: "UEFA Limit 70%", fill: "#ef4444", fontSize: 10 }}
        />
        <ReferenceLine
          y={65}
          stroke="#f59e0b"
          strokeDasharray="4 4"
          label={{ value: "Warning 65%", fill: "#f59e0b", fontSize: 10 }}
        />
        <Area
          type="monotone"
          dataKey="ratio"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#ratioGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function WageRevenueChart({
  projections,
}: {
  projections: YearlyProjection[];
}) {
  const data = projections.map((p) => ({
    year: p.year,
    wages: +(p.wage_bill / 1e6).toFixed(1),
    revenue: +(p.revenue / 1e6).toFixed(1),
    squad_cost: +(p.squad_cost / 1e6).toFixed(1),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="year"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="M"
        />
        <Tooltip
          contentStyle={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 8,
          }}
          labelStyle={{ color: "#94a3b8" }}
          formatter={(v) => [`€${v}M`]}
          labelFormatter={(label) => `Year ${label}`}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#revGrad)"
        />
        <Area
          type="monotone"
          dataKey="squad_cost"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#costGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
