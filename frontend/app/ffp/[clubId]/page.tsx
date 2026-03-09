'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ffpApi, simulationsApi } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { Card, Skeleton, ErrorMessage, Badge, KpiCard, EmptyState } from '@/components/ui';
import { formatEur, formatPct, ffpStatusBg } from '@/lib/utils';
import { FFPProjectionChart } from '@/components/charts/FFPChart';
import { BarChart3, TrendingUp, DollarSign, AlertTriangle, ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState } from 'react';

export default function FFPPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const searchParams = useSearchParams();
  const preselectedSim = searchParams.get('sim_id');
  const id = Number(clubId);
  const { isAuthenticated } = useAuth();
  const [selectedSim, setSelectedSim] = useState<string | null>(preselectedSim);

  const { data: ffp, isLoading, error, refetch } = useQuery({
    queryKey: ['ffp', id, selectedSim],
    queryFn: () => ffpApi.dashboard(id, selectedSim),
    enabled: !isNaN(id),
  });

  const { data: mySims } = useQuery({
    queryKey: ['simulations-my'],
    queryFn: () => simulationsApi.listMy(),
    enabled: isAuthenticated,
  });

  const clubSims = mySims?.filter(s => s.club_api_football_id === id) ?? [];

  if (isLoading) return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );

  if (error) return (
    <div className="container mx-auto px-4 py-10">
      <ErrorMessage message={(error as Error).message} onRetry={refetch} />
    </div>
  );

  if (!ffp) return null;

  const status = ffp.current_ffp_status;
  const isSimOverlay = !!ffp.simulation_id;

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <Link href={`/clubs/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-2 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Club
            </Link>
            <h1 className="text-2xl font-display font-black flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" /> FFP Dashboard
            </h1>
            <p className="text-muted-foreground">{ffp.club_name} · Season {ffp.season_year}</p>
          </div>

          {/* Simulation selector */}
          {isAuthenticated && clubSims.length > 0 && (
            <div className="shrink-0">
              <label className="text-xs text-muted-foreground block mb-1">Simulation overlay</label>
              <select
                value={selectedSim ?? ''}
                onChange={e => setSelectedSim(e.target.value || null)}
                className="h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Real squad (no overlay)</option>
                {clubSims.map(s => (
                  <option key={s.id} value={s.id}>{s.simulation_name} ({s.season})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Simulation overlay banner */}
        {isSimOverlay && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-2 text-sm">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <span>Showing <strong>{ffp.simulation_name}</strong> overlay. Numbers include simulation transfers.</span>
            <button onClick={() => setSelectedSim(null)} className="ml-auto text-primary hover:underline text-xs">Remove overlay</button>
          </div>
        )}

        {!ffp.revenue_configured && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Revenue not configured — FFP ratios use an estimate. Sport Directors can set real revenue.
          </div>
        )}

        {/* FFP Status */}
        <Card className="p-5 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">FFP Status</p>
              <Badge className={`text-base font-bold px-4 py-1.5 ${ffpStatusBg(status.status)}`}>
                {status.badge}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">{status.reason}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-display font-black">{formatPct(status.squad_cost_ratio)}</p>
                <p className="text-xs text-muted-foreground">Squad Cost Ratio</p>
                <p className="text-xs text-muted-foreground opacity-60">UEFA limit: 70%</p>
              </div>
              <div>
                <p className={`text-2xl font-display font-black ${status.break_even_ok ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatEur(status.break_even_result, true)}
                </p>
                <p className="text-xs text-muted-foreground">Break-Even Result</p>
                <p className="text-xs text-muted-foreground opacity-60">Limit: -€5M</p>
              </div>
            </div>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Wage Bill"
            value={formatEur(ffp.current_wage_bill, true)}
            icon={<DollarSign className="w-4 h-4" />}
          />
          <KpiCard
            label="Amortization"
            value={formatEur(ffp.current_amortization, true)}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <KpiCard
            label="Squad Cost"
            value={formatEur(ffp.current_squad_cost, true)}
          />
          <KpiCard
            label="Cost Ratio"
            value={formatPct(ffp.current_squad_cost_ratio)}
            sub={`Data: ${ffp.salary_data_source}`}
          />
        </div>

        {/* Simulation Breakdown */}
        {isSimOverlay && (
          <Card className="p-5 mb-6">
            <h3 className="font-display font-bold mb-4">Simulation Impact</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Baseline Wages</p>
                <p className="text-lg font-bold">{formatEur(ffp.baseline_wage_bill, true)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Extra Wages (buys/loans-in)</p>
                <p className="text-lg font-bold text-red-500">+{formatEur(ffp.simulation_extra_wages, true)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Wage Relief (sells/loans-out)</p>
                <p className="text-lg font-bold text-emerald-500">-{formatEur(ffp.simulation_wage_relief, true)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Spend</p>
                <p className={`text-lg font-bold ${(ffp.simulation_net_spend ?? 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {formatEur(ffp.simulation_net_spend, true)}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Charts */}
        {ffp.projections.length > 0 ? (
          <Card className="p-5">
            <h3 className="font-display font-bold mb-4">3-Year Projections</h3>
            <FFPProjectionChart projections={ffp.projections} />
          </Card>
        ) : (
          <EmptyState
            icon={<BarChart3 className="w-7 h-7" />}
            title="No projection data"
            description="Configure club revenue to see FFP projections"
          />
        )}
      </motion.div>
    </div>
  );
}
