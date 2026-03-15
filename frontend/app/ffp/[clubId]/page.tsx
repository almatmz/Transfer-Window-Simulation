'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ffpApi, simulationsApi, CURRENT_SEASON } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { PageLoader, ErrorMessage, Badge, Card, KpiCard, FFPBadge } from '@/components/ui';
import { formatEur, formatPct } from '@/lib/utils';
import { BarChart3, ArrowLeft, TrendingUp, DollarSign, AlertCircle, Lock, ChevronDown } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ReferenceLine, CartesianGrid } from 'recharts';
import Link from 'next/link';
import { useState, Suspense } from 'react';
import { cn } from '@/lib/utils';

function FFPContent() {
  const { clubId } = useParams<{ clubId: string }>();
  const id = parseInt(clubId);
  const { isAuthenticated } = useAuth();
  const [simId, setSimId] = useState<string>('');

  const { data: ffp, isLoading, error } = useQuery({
    queryKey: ['ffp', id, simId],
    queryFn: () => ffpApi.dashboard(id, simId || undefined),
    enabled: !!id,
  });

  const { data: sims } = useQuery({
    queryKey: ['my-sims-for-club', id],
    queryFn: () => simulationsApi.listMy().then(list => list.filter(s => s.club_api_football_id === id)),
    enabled: !!isAuthenticated,
  });

  if (isLoading) return <PageLoader />;
  if (error || !ffp) return <ErrorMessage message={(error as Error)?.message ?? 'Failed to load FFP data'} />;

  const status = ffp.current_ffp_status;
  const statusClass = status.status?.toLowerCase() === 'compliant' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : status.status?.toLowerCase() === 'warning' ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20';

  const projData = ffp.projections.map(p => ({
    year: `${p.year}/${String(p.year + 1).slice(2)}`,
    'Wage Bill': Math.round(p.wage_bill / 1e6),
    'Revenue': Math.round(p.revenue / 1e6),
    'Squad Cost': Math.round(p.squad_cost / 1e6),
    'SCR %': +(p.squad_cost_ratio * 100).toFixed(1),
    status: p.ffp_status,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 animate-fade-up">
        <div className="flex items-center gap-3">
          <Link href={`/clubs/${id}`} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />FFP Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">{ffp.club_name} · Season {ffp.season_year}/{String(ffp.season_year + 1).slice(2)}</p>
          </div>
        </div>
        {sims && sims.length > 0 && (
          <div className="shrink-0">
            <label className="block text-xs text-muted-foreground mb-1">Overlay simulation</label>
            <select value={simId} onChange={e => setSimId(e.target.value)}
              className="h-8 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 max-w-48">
              <option value="">— Baseline only —</option>
              {sims.map(s => <option key={s.id} value={s.id}>{s.simulation_name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* FFP Status Banner */}
      <div className={cn('flex items-start gap-3 p-4 rounded-2xl border animate-fade-up', statusClass)} style={{animationDelay:'0.05s'}}>
        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold">{status.badge || status.status}</p>
          <p className="text-sm opacity-80 mt-0.5">{status.reason || 'No additional details'}</p>
          {!ffp.revenue_configured && (
            <p className="text-xs mt-1.5 opacity-70">⚠ Revenue not configured — results may be inaccurate</p>
          )}
        </div>
      </div>

      {/* Simulation overlay info */}
      {ffp.simulation_id && (
        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm animate-fade-up">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span>Showing simulation: <strong>{ffp.simulation_name}</strong></span>
          {ffp.simulation_extra_wages != null && (
            <span className="ml-auto text-xs text-muted-foreground">
              +{formatEur(ffp.simulation_extra_wages, true)} wages · -{formatEur(ffp.simulation_wage_relief ?? 0, true)} relief · Net {formatEur(ffp.simulation_net_spend ?? 0, true)}
            </span>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-up" style={{animationDelay:'0.1s'}}>
        <KpiCard label="Annual Revenue" value={formatEur(ffp.annual_revenue, true)}
          sub={ffp.revenue_configured ? `Configured · ${ffp.salary_data_source}` : 'Not configured'}
          icon={<DollarSign className="w-4 h-4" />} />
        <KpiCard label="Wage Bill" value={formatEur(ffp.current_wage_bill, true)}
          icon={<TrendingUp className="w-4 h-4" />} />
        <KpiCard label="Amortization" value={formatEur(ffp.current_amortization, true)} />
        <KpiCard label="Squad Cost Ratio" value={formatPct(ffp.current_squad_cost_ratio)}
          sub={`Limit ${formatPct(ffp.squad_cost_ratio_limit)} · Warning ${formatPct(ffp.squad_cost_ratio_warning)}`} />
      </div>

      {/* Charts */}
      {projData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up" style={{animationDelay:'0.15s'}}>
          <Card>
            <h3 className="font-semibold text-sm mb-4">Revenue vs Costs (€M)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Revenue" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                <Bar dataKey="Wage Bill" fill="hsl(var(--destructive))" opacity={0.7} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3 className="font-semibold text-sm mb-4">Squad Cost Ratio (%)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={projData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                <ReferenceLine y={70} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: '70% limit', fontSize: 10, fill: 'hsl(var(--destructive))' }} />
                <ReferenceLine y={65} stroke="hsl(38 92% 50%)" strokeDasharray="4 4" label={{ value: '65% warn', fontSize: 10, fill: 'hsl(38 92% 50%)' }} />
                <Line type="monotone" dataKey="SCR %" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Projection table */}
      {ffp.projections.length > 0 && (
        <Card padding={false} className="animate-fade-up overflow-hidden" style={{animationDelay:'0.2s'}}>
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Multi-Year Projection</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border bg-secondary/30">
                {['Year', 'Revenue', 'Wages', 'Amort.', 'Squad Cost', 'SCR', 'Op. Result', 'Status'].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {ffp.projections.map(p => (
                  <tr key={p.year} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{p.year}/{String(p.year + 1).slice(2)}</td>
                    <td className="py-2.5 px-3">{formatEur(p.revenue, true)}</td>
                    <td className="py-2.5 px-3">{formatEur(p.wage_bill, true)}</td>
                    <td className="py-2.5 px-3">{formatEur(p.amortization, true)}</td>
                    <td className="py-2.5 px-3">{formatEur(p.squad_cost, true)}</td>
                    <td className="py-2.5 px-3">{formatPct(p.squad_cost_ratio)}</td>
                    <td className={cn('py-2.5 px-3', p.operating_result >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                      {formatEur(p.operating_result, true)}
                    </td>
                    <td className="py-2.5 px-3"><FFPBadge status={p.ffp_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function FFPPage() {
  return <Suspense fallback={<PageLoader />}><FFPContent /></Suspense>;
}
