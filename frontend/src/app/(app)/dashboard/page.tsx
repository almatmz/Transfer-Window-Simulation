'use client'
import { AppLayout } from '@/components/layout/app-layout'
import { useMe, useSimulations } from '@/services/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatEur } from '@/lib/utils'
import { Activity, TrendingUp, Search, Info, ArrowRight, Zap, Shield, BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: user } = useMe()
  const { data: sims } = useSimulations()
  const recent = (sims || []).slice(0, 5)

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">

        {/* Hero welcome banner */}
        <div className="relative overflow-hidden rounded-2xl p-6 lg:p-8"
          style={{
            background: 'linear-gradient(135deg, var(--c-accent) 0%, #7c3aed 100%)',
            boxShadow: '0 8px 32px rgba(37,99,235,0.3)',
          }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 0%, transparent 60%)' }} />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-white">
                Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''} 👋
              </h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Simulate transfers and analyze UEFA Financial Sustainability compliance.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link href="/clubs">
                <Button size="sm" className="!bg-white/15 hover:!bg-white/25 !text-white !border-white/20 !shadow-none">
                  <Search className="w-3.5 h-3.5" /> Find Club
                </Button>
              </Link>
              <Link href="/simulations">
                <Button size="sm" className="!bg-white !text-blue-700 !shadow-none hover:!bg-white/90">
                  <Activity className="w-3.5 h-3.5" /> New Sim
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="My Simulations" value={sims?.length ?? 0}     icon={Activity}   accent="blue"    />
          <StatCard label="My Role"         value={user?.role?.replace('_', ' ') ?? '—'} icon={Shield} accent="purple" />
          <StatCard label="Season"          value="2025/26"                icon={TrendingUp} accent="emerald" />
          <StatCard label="SCR Limit"       value="70%"  sub="Squad Cost Ratio" icon={Info}  accent="amber"   />
        </div>

        {/* Recent simulations + FFP rules */}
        <div className="grid lg:grid-cols-5 gap-5">
          {/* Recent sims — 3 cols */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Recent Simulations</CardTitle>
              <Link href="/simulations">
                <Button size="xs" variant="ghost">View all <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recent.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <Activity className="w-8 h-8 mx-auto mb-3 c-text-3 opacity-50" />
                  <p className="text-sm font-medium c-text-2">No simulations yet</p>
                  <p className="text-xs c-text-3 mt-1 mb-4">Start modeling your ideal transfer window</p>
                  <Link href="/simulations"><Button size="sm">Create first simulation</Button></Link>
                </div>
              ) : (
                <div>
                  {recent.map((s, i) => (
                    <Link key={s.id} href={`/simulations/${s.id}`}
                      className="flex items-center justify-between px-6 py-3.5 transition-colors group"
                      style={{
                        borderTop: i > 0 ? '1px solid var(--c-border)' : undefined,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg-raised)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-400"
                          style={{ background: 'rgba(59,130,246,0.1)' }}>
                          {s.club_name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold c-text truncate">{s.name}</p>
                          <p className="text-xs c-text-3">{s.club_name} · {s.season_year} · {s.window_type}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="flex-shrink-0">{s.transfers.length} transfers</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* FFP Quick Reference — 2 cols */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle><Zap className="w-3.5 h-3.5 inline mr-1.5 text-amber-500" />FFP Quick Ref</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              {[
                { label: 'Squad Cost Ratio', value: '≤ 70%',   color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  desc: 'Wages + amortization vs revenue' },
                { label: 'Warning Zone',      value: '65–70%',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',  desc: 'Transfer restrictions apply' },
                { label: 'Break-Even',        value: '−€5M',    color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',   desc: '3-year rolling max loss' },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3.5"
                  style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs c-text-3">{item.label}</p>
                    <span className="text-sm font-bold font-mono" style={{ color: item.color }}>{item.value}</span>
                  </div>
                  <p className="text-xs c-text-3 leading-relaxed">{item.desc}</p>
                </div>
              ))}
              <Link href="/ffp">
                <Button variant="ghost" size="sm" className="w-full mt-1">
                  <BarChart3 className="w-3.5 h-3.5" /> Open FFP Analyzer
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

      </div>
    </AppLayout>
  )
}
