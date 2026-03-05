'use client'
import { useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { FFPDashboard } from '@/features/ffp/ffp-dashboard'
import { useClub, useSimulations } from '@/services/queries'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Activity } from 'lucide-react'

export default function FFPPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const clubId = parseInt(params.clubId as string)
  const defaultSim = searchParams.get('sim') || ''
  const [simId, setSimId] = useState(defaultSim)

  const { data: club } = useClub(clubId)
  const { data: sims } = useSimulations()

  const clubSims = (sims || []).filter(s => s.club_api_football_id === clubId)

  return (
    <AppLayout title="FFP Analysis">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/clubs/${clubId}`}>
              <Button size="sm" variant="ghost"><ArrowLeft className="w-3.5 h-3.5" /> Back</Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                {club?.logo_url && <img src={club.logo_url} alt="" className="w-6 h-6 object-contain" />}
                <h2 className="text-xl font-bold text-slate-100">{club?.name || 'Club'}</h2>
              </div>
              <p className="text-slate-500 text-sm">UEFA Financial Fair Play Analysis</p>
            </div>
          </div>

          {/* Simulation overlay selector */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {clubSims.length > 0 && (
              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <Activity className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <Select
                  value={simId}
                  onChange={e => setSimId(e.target.value)}
                  className="text-xs min-w-[200px]"
                >
                  <option value="">Real squad only</option>
                  {clubSims.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
            )}
            {simId && (
              <Badge variant="info">Simulation overlay active</Badge>
            )}
            <Link href={`/simulations?club=${clubId}`}>
              <Button size="sm" variant="outline"><Activity className="w-3.5 h-3.5" /> New Simulation</Button>
            </Link>
          </div>
        </div>

        <FFPDashboard clubId={clubId} simId={simId || undefined} />
      </div>
    </AppLayout>
  )
}
