'use client'
import { useFFP } from '@/services/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { PageSpinner } from '@/components/ui/spinner'
import { FFPProjectionChart, WageRevenueChart } from '@/components/charts/ffp-chart'
import { formatEur, ffpStatusBg } from '@/lib/utils'
import { DollarSign, TrendingUp, Users, BarChart3, AlertTriangle } from 'lucide-react'
import type { FFPStatusValue, OverallStatus } from '@/types'

function statusBadgeVariant(s: FFPStatusValue | OverallStatus) {
  if (s === 'SAFE' || s === 'OK') return 'success'
  if (s === 'MONITORING' || s === 'WARNING') return 'warning'
  return 'danger'
}

export function FFPDashboard({ clubId, simId }: { clubId: number; simId?: string }) {
  const { data, isLoading, error } = useFFP(clubId, simId)

  if (isLoading) return <PageSpinner />
  if (error) {
    const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <p className="text-sm text-amber-300">{msg || 'Could not load FFP data. Set club revenue first.'}</p>
      </div>
    )
  }
  if (!data) return null

  const gaugeWidth = Math.min(data.squad_cost_ratio * 100, 100)

  return (
    <div className="space-y-6">
      {/* Overall status banner */}
      <div className={`rounded-xl border p-4 flex items-center justify-between ${ffpStatusBg(data.overall_status)}`}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-70">Overall FFP Status</p>
          <p className="text-lg font-bold mt-0.5">{data.overall_status.replace('_', ' ')}</p>
          {simId && data.simulation_name && (
            <p className="text-xs opacity-60 mt-0.5">Simulation: {data.simulation_name}</p>
          )}
        </div>
        <Badge variant={statusBadgeVariant(data.overall_status)} className="text-sm px-3 py-1">
          {data.squad_cost_ratio_pct} Squad Cost
        </Badge>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Annual Revenue" value={formatEur(data.annual_revenue, true)} icon={DollarSign} accent="emerald" />
        <StatCard label="Wage Bill" value={formatEur(data.wage_bill, true)} icon={Users} accent="blue" />
        <StatCard label="Amortization" value={formatEur(data.total_amortization, true)} icon={TrendingUp} accent="purple" />
        <StatCard label="Squad Cost" value={formatEur(data.squad_cost, true)} sub={data.squad_cost_ratio_pct} icon={BarChart3} accent={data.squad_cost_status === 'OK' ? 'emerald' : data.squad_cost_status === 'WARNING' ? 'amber' : 'red'} />
      </div>

      {/* Squad cost ratio gauge */}
      <Card>
        <CardHeader>
          <CardTitle>Squad Cost Ratio — UEFA FSR Limit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-slate-500">
              <span>0%</span>
              <span className="text-amber-400">Warning 65%</span>
              <span className="text-red-400">Limit 70%</span>
              <span>100%</span>
            </div>
            <div className="h-4 bg-slate-800 rounded-full overflow-hidden relative">
              <div className="absolute top-0 left-0 h-full bg-amber-500/20 border-r border-amber-500/50" style={{ width: '65%' }} />
              <div className="absolute top-0 left-0 h-full bg-red-500/20" style={{ width: '100%', left: '65%' }} />
              <div
                className={`h-full rounded-full transition-all duration-700 ${data.squad_cost_status === 'OK' ? 'bg-emerald-500' : data.squad_cost_status === 'WARNING' ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${gaugeWidth}%` }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-semibold text-slate-200">{data.squad_cost_ratio_pct}</span>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>Contracts: {data.contract_count}</span>
                <span>Break-even: <span className={ffpStatusBg(data.break_even_status).split(' ')[1]}>{data.break_even_label}</span></span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulation breakdown */}
      {simId && data.sim_net_spend != null && (
        <Card>
          <CardHeader><CardTitle>Simulation Financial Impact</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'Added Wages', value: data.sim_added_wages, color: 'text-red-400' },
                { label: 'Wage Relief', value: data.sim_removed_wages, color: 'text-emerald-400' },
                { label: 'Added Amortization', value: data.sim_added_amortization, color: 'text-red-400' },
                { label: 'Net Transfer Spend', value: data.sim_net_spend, color: data.sim_net_spend! > 0 ? 'text-red-400' : 'text-emerald-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className={`font-semibold ${color}`}>{formatEur(value ?? 0, true)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>3-Year Squad Cost Ratio Projection</CardTitle></CardHeader>
          <CardContent><FFPProjectionChart projections={data.projections} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Revenue vs Squad Cost</CardTitle></CardHeader>
          <CardContent><WageRevenueChart projections={data.projections} /></CardContent>
        </Card>
      </div>

      {/* Projections table */}
      <Card>
        <CardHeader><CardTitle>3-Year Projection Table</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Year', 'Revenue', 'Wages', 'Amortization', 'Squad Cost', 'Ratio', 'Status'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data.projections.map(p => (
                  <tr key={p.year} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-200">{p.year}</td>
                    <td className="px-6 py-3 text-slate-400">{formatEur(p.revenue, true)}</td>
                    <td className="px-6 py-3 text-slate-400">{formatEur(p.wage_bill, true)}</td>
                    <td className="px-6 py-3 text-slate-400">{formatEur(p.amortization, true)}</td>
                    <td className="px-6 py-3 text-slate-400">{formatEur(p.squad_cost, true)}</td>
                    <td className="px-6 py-3 font-medium text-slate-200">{(p.squad_cost_ratio * 100).toFixed(1)}%</td>
                    <td className="px-6 py-3"><Badge variant={statusBadgeVariant(p.ffp_status)}>{p.ffp_status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
