'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { useClub, useUpdateRevenue, useSyncClub } from '@/services/queries'
import { SquadTable } from '@/features/clubs/squad-table'
import { ContractsTable } from '@/features/clubs/contracts-table'
import { FFPDashboard } from '@/features/ffp/ffp-dashboard'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { PageSpinner } from '@/components/ui/spinner'
import { Modal } from '@/components/ui/modal'
import { formatEur } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { DollarSign, RefreshCw, Edit2, TrendingUp, Activity } from 'lucide-react'
import { toast } from '@/components/ui/toaster'

export default function ClubPage() {
  const params = useParams()
  const clubId = parseInt(params.id as string)
  const { data: club, isLoading } = useClub(clubId)
  const { isSportDirector, isAdmin } = useAuthStore()
  const [activeTab, setActiveTab] = useState('Overview')
  const [revenueModal, setRevenueModal] = useState(false)
  const [revenueInput, setRevenueInput] = useState('')
  const updateRevenue = useUpdateRevenue(clubId)
  const syncClub = useSyncClub(clubId)

  const tabs = ['Overview', 'Squad', ...(isSportDirector() ? ['Contracts'] : []), 'FFP Dashboard']

  if (isLoading) return <AppLayout><PageSpinner /></AppLayout>
  if (!club) return <AppLayout><p className="text-slate-400">Club not found.</p></AppLayout>

  const handleRevenueSave = async () => {
    const val = parseFloat(revenueInput)
    if (isNaN(val) || val <= 0) { toast('Enter a valid revenue > 0', 'error'); return }
    try {
      await updateRevenue.mutateAsync({ revenue: val })
      toast('Revenue updated', 'success')
      setRevenueModal(false)
    } catch { toast('Failed to update revenue', 'error') }
  }

  return (
    <AppLayout title={club.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {club.logo_url ? (
              <img src={club.logo_url} alt={club.name} className="w-16 h-16 object-contain flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl font-bold text-slate-500 flex-shrink-0">
                {club.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <h2 className="text-2xl font-bold text-slate-100">{club.name}</h2>
                {!club.revenue_configured && <Badge variant="warning">Revenue not set</Badge>}
              </div>
              <p className="text-slate-500 text-sm">{club.league || club.country} · {club.country} · Season {club.season_year}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Link href={`/ffp/${clubId}`}><Button size="sm"><TrendingUp className="w-3.5 h-3.5" /> FFP Analysis</Button></Link>
                <Link href={`/simulations?club=${clubId}`}><Button size="sm" variant="outline"><Activity className="w-3.5 h-3.5" /> Simulate</Button></Link>
                {isSportDirector() && (
                  <Button size="sm" variant="secondary" onClick={() => { setRevenueInput(String(club.annual_revenue || '')); setRevenueModal(true) }}>
                    <Edit2 className="w-3.5 h-3.5" /> Set Revenue
                  </Button>
                )}
                {isAdmin() && (
                  <Button size="sm" variant="ghost" loading={syncClub.isPending} onClick={() => syncClub.mutate().then(() => toast('Squad synced', 'success'))}>
                    <RefreshCw className="w-3.5 h-3.5" /> Sync Squad
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Annual Revenue" value={club.annual_revenue > 0 ? formatEur(club.annual_revenue, true) : 'Not set'}
            icon={DollarSign} accent={club.annual_revenue > 0 ? 'emerald' : 'amber'} />
          <StatCard label="Equity Limit" value={formatEur(club.equity_injection_limit, true)} icon={DollarSign} accent="purple" />
          <StatCard label="Season" value={String(club.season_year)} icon={RefreshCw} accent="blue" />
          <StatCard label="Last Synced" value={new Date(club.last_synced_at).toLocaleDateString()} icon={RefreshCw} accent="emerald" />
        </div>

        {/* Tabs */}
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {activeTab === 'Overview' && (
          <Card>
            <CardHeader><CardTitle>Club Information</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm">
                {[
                  ['Full Name', club.name], ['Country', club.country], ['League', club.league || '—'],
                  ['Revenue', club.annual_revenue > 0 ? formatEur(club.annual_revenue) : 'Not configured'],
                  ['Equity Injection Limit', formatEur(club.equity_injection_limit)],
                  ['Current Season', club.season_year],
                ].map(([k, v]) => (
                  <div key={k as string} className="space-y-1">
                    <dt className="text-xs text-slate-600 uppercase tracking-wider">{k}</dt>
                    <dd className="font-medium text-slate-200">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}
        {activeTab === 'Squad' && <SquadTable clubId={clubId} />}
        {activeTab === 'Contracts' && <ContractsTable clubId={clubId} />}
        {activeTab === 'FFP Dashboard' && <FFPDashboard clubId={clubId} />}
      </div>

      {/* Revenue modal */}
      <Modal open={revenueModal} onClose={() => setRevenueModal(false)} title="Set Annual Revenue" size="sm">
        <div className="space-y-4">
          <Input label="Annual Revenue (€)" type="number" placeholder="e.g. 600000000 for €600M"
            value={revenueInput} onChange={e => setRevenueInput(e.target.value)} />
          <p className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3">
            This value is used to calculate the UEFA Squad Cost Ratio. Required before FFP dashboard works.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setRevenueModal(false)}>Cancel</Button>
            <Button loading={updateRevenue.isPending} onClick={handleRevenueSave}>Save Revenue</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
