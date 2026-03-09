'use client';

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine, Area, AreaChart,
} from 'recharts';
import type { YearlyProjection } from '@/lib/api/types';
import { formatEur, formatPct } from '@/lib/utils';

interface FFPChartProps {
  projections: YearlyProjection[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl p-3 shadow-xl text-sm">
      <p className="font-display font-bold mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </span>
          <span className="font-medium">
            {entry.name === 'Ratio' ? formatPct(entry.value / 100) : formatEur(entry.value, true)}
          </span>
        </div>
      ))}
    </div>
  );
};

export function FFPProjectionChart({ projections }: FFPChartProps) {
  const data = projections.map(p => ({
    year: p.year,
    'Wage Bill': p.wage_bill,
    Amortization: p.amortization,
    Revenue: p.revenue,
    'Squad Cost': p.squad_cost,
    Ratio: p.squad_cost_ratio * 100,
    status: p.ffp_status,
  }));

  return (
    <div className="space-y-6">
      {/* Squad Cost vs Revenue */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Squad Cost vs Revenue (€)</p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={v => formatEur(v, true)} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="Wage Bill" stackId="cost" fill="hsl(217 91% 60% / 0.7)" radius={[0,0,4,4]} />
            <Bar dataKey="Amortization" stackId="cost" fill="hsl(217 91% 45% / 0.8)" radius={[4,4,0,0]} />
            <Line dataKey="Revenue" stroke="hsl(142 71% 45%)" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Squad Cost Ratio */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Squad Cost Ratio (%)</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="ratioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={v => `${v}%`} width={45} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={70} stroke="hsl(0 84% 60%)" strokeDasharray="4 4" label={{ value: 'UEFA 70%', fill: 'hsl(0 84% 60%)', fontSize: 11 }} />
            <ReferenceLine y={65} stroke="hsl(38 92% 50%)" strokeDasharray="4 4" label={{ value: 'Warning 65%', fill: 'hsl(38 92% 50%)', fontSize: 11 }} />
            <Area dataKey="Ratio" stroke="hsl(217 91% 60%)" fill="url(#ratioGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SimProjectionChart({ projections }: FFPChartProps) {
  const data = projections.map(p => ({
    year: p.year,
    'Net Spend': p.net_transfer_spend,
    'Operating Result': p.operating_result,
    status: p.ffp_status,
  }));

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground mb-3">Financial Projections (€)</p>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={v => formatEur(v, true)} width={65} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <Bar dataKey="Net Spend" fill="hsl(217 91% 60% / 0.7)" radius={[4,4,0,0]} />
          <Line dataKey="Operating Result" stroke="hsl(142 71% 45%)" strokeWidth={2} dot />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
