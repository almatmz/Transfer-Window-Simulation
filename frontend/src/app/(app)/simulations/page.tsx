'use client'
import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useSimulations, useCreateSimulation, useDeleteSimulation } from '@/services/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageSpinner } from '@/components/ui/spinner'
import { Plus, Trash2, ChevronRight, Activity } from 'lucide-react'
import Link from 'next/link'

export default function SimulationsPage() {
  const { data: sims, isLoading } = useSimulations()
  const createSim = useCreateSimulation()
  const deleteSim = useDeleteSimulation()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ club_api_football_id: '', name: '', season_year: '2025', window_type: 'summer' })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.club_api_football_id || !form.name) return
    await createSim.mutateAsync({
      club_api_football_id: parseInt(form.club_api_football_id),
      name: form.name,
      season_year: parseInt(form.season_year),
      window_type: form.window_type,
    })
    setShowForm(false)
    setForm({ club_api_football_id: '', name: '', season_year: '2025', window_type: 'summer' })
  }

  return (
    <AppLayout title="Simulations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Transfer Simulations</h2>
            <p className="text-slate-500 text-sm mt-0.5">Build transfer scenarios and analyze FFP impact.</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" /> New Simulation
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle>Create Simulation</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
                <Input label="Club API Football ID" placeholder="e.g. 33 for Man Utd, 541 for Real Madrid"
                  value={form.club_api_football_id} onChange={e => setForm({ ...form, club_api_football_id: e.target.value })} />
                <Input label="Simulation Name" placeholder="e.g. Summer 2026 Window"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input label="Season Year" type="number" value={form.season_year}
                  onChange={e => setForm({ ...form, season_year: e.target.value })} />
                <Select label="Window Type" value={form.window_type}
                  onChange={e => setForm({ ...form, window_type: e.target.value })}>
                  <option value="summer">Summer</option>
                  <option value="winter">Winter</option>
                </Select>
                <div className="col-span-2 flex gap-2">
                  <Button type="submit" loading={createSim.isPending}>Create</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading ? <PageSpinner /> : (
          <div className="space-y-2">
            {(sims || []).length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No simulations yet.</p>
                <button onClick={() => setShowForm(true)} className="text-blue-400 hover:underline text-sm mt-1">Create your first simulation →</button>
              </div>
            ) : (
              (sims || []).map(sim => (
                <div key={sim.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-all group">
                  <Link href={`/simulations/${sim.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 flex-shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-200 group-hover:text-white truncate">{sim.name}</p>
                      <p className="text-xs text-slate-500">{sim.club_name} · {sim.season_year} · {sim.window_type}</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{sim.transfers.length} transfers</Badge>
                    <button onClick={() => deleteSim.mutate(sim.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-red-500/5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Link href={`/simulations/${sim.id}`}><ChevronRight className="w-4 h-4 text-slate-600" /></Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
