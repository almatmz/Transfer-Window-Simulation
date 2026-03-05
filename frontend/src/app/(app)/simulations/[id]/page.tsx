'use client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/app-layout'
import { useSimulation, useRemoveTransfer } from '@/services/queries'
import { TransferForm } from '@/features/simulations/transfer-form'
import { FFPDashboard } from '@/features/ffp/ffp-dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageSpinner } from '@/components/ui/spinner'
import { formatEur, transferTypeColor } from '@/lib/utils'
import { Trash2, TrendingUp } from 'lucide-react'

export default function SimulationDetailPage() {
  const params = useParams()
  const simId = params.id as string
  const { data: sim, isLoading } = useSimulation(simId)
  const removeTransfer = useRemoveTransfer(simId)

  if (isLoading) return <AppLayout><PageSpinner /></AppLayout>
  if (!sim) return <AppLayout><p className="text-slate-400">Simulation not found.</p></AppLayout>

  return (
    <AppLayout title={sim.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">{sim.name}</h2>
            <p className="text-slate-500 text-sm">{sim.club_name} · {sim.season_year} {sim.window_type} window</p>
          </div>
          <Link href={`/ffp/${sim.club_api_football_id}?sim=${sim.id}`}>
            <Button size="sm" variant="outline"><TrendingUp className="w-3.5 h-3.5" /> FFP with Simulation</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transfer list */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle>Transfers ({sim.transfers.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                {sim.transfers.length === 0 ? (
                  <p className="px-6 py-8 text-center text-slate-500 text-sm">No transfers added yet. Use the form →</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800">
                          {['Type', 'Player', 'Position', 'Fee', 'Salary / yr', ''].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {sim.transfers.map(t => (
                          <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${transferTypeColor(t.type)}`}>
                                {t.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-200">{t.player_name}</td>
                            <td className="px-4 py-3 text-slate-400">{t.position}</td>
                            <td className="px-4 py-3 text-slate-300">{t.transfer_fee > 0 ? formatEur(t.transfer_fee, true) : '—'}</td>
                            <td className="px-4 py-3 text-slate-300">{t.annual_salary > 0 ? formatEur(t.annual_salary, true) : '—'}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => removeTransfer.mutate(t.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Transfer form */}
          <div>
            <TransferForm simId={simId} />
          </div>
        </div>

        {/* FFP Impact */}
        <div>
          <h3 className="text-base font-semibold text-slate-200 mb-4">FFP Impact with this Simulation</h3>
          <FFPDashboard clubId={sim.club_api_football_id} simId={sim.id} />
        </div>
      </div>
    </AppLayout>
  )
}
