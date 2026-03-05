'use client'
import { AppLayout } from '@/components/layout/app-layout'
import { useMe } from '@/services/queries'
import { useSimulations } from '@/services/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { formatEur, ffpStatusBg } from '@/lib/utils'
import { Activity, TrendingUp, Search, Info } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const { data: user } = useMe()
  const { data: sims } = useSimulations()

  const recent = (sims || []).slice(0, 5)

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome */}
        <div className="rounded-xl bg-gradient-to-r from-blue-900/30 via-slate-900/50 to-purple-900/20 border border-blue-500/10 p-6">
          <h2 className="text-xl font-bold text-slate-100">
            Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''} 👋
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Simulate transfers and analyze UEFA Financial Fair Play impact.
          </p>
          <div className="flex gap-3 mt-4">
            <Link href="/clubs"><Button size="sm"><Search className="w-3.5 h-3.5" />Find a Club</Button></Link>
            <Link href="/simulations"><Button size="sm" variant="outline"><Activity className="w-3.5 h-3.5" />New Simulation</Button></Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="My Simulations" value={sims?.length || 0} icon={Activity} accent="blue" />
          <StatCard label="Role" value={user?.role?.replace('_', ' ') || '—'} icon={TrendingUp} accent="purple" />
          <StatCard label="Season" value="2025/26" icon={TrendingUp} accent="emerald" />
          <StatCard label="FFP Limit" value="70%" sub="Squad Cost Ratio" icon={Info} accent="amber" />
        </div>

        {/* Recent simulations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Simulations</CardTitle>
            <Link href="/simulations"><Button size="sm" variant="ghost">View all</Button></Link>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-500 text-sm">
                No simulations yet. <Link href="/simulations" className="text-blue-400 hover:underline">Create one →</Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {recent.map(s => (
                  <Link key={s.id} href={`/simulations/${s.id}`} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-800/30 transition-colors group">
                    <div>
                      <p className="text-sm font-medium text-slate-200 group-hover:text-white">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.club_name} · {s.season_year} · {s.window_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{s.transfers.length} transfers</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* FFP Explainer */}
        <Card>
          <CardHeader><CardTitle>UEFA Financial Sustainability Rules</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[
                { label: 'Squad Cost Ratio', value: '≤ 70%', desc: 'Wages + amortization cannot exceed 70% of revenue from 2025/26', color: 'emerald' },
                { label: 'Warning Zone', value: '65–70%', desc: 'Clubs in this range face monitoring and potential transfer restrictions', color: 'amber' },
                { label: 'Break-Even', value: '−€5M', desc: 'Max 3-year rolling loss. Up to −€60M with approved equity injection', color: 'red' },
              ].map(item => (
                <div key={item.label} className={`rounded-lg border p-4 bg-${item.color}-500/5 border-${item.color}-500/20`}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{item.label}</p>
                  <p className={`text-xl font-bold text-${item.color}-400 mt-1`}>{item.value}</p>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
