'use client'
import { useState } from 'react'
import { useSquad } from '@/services/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageSpinner } from '@/components/ui/spinner'
import { useAuthStore } from '@/store/auth'
import { formatEur } from '@/lib/utils'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

const positionColor: Record<string, string> = {
  GK: 'bg-yellow-500/10 text-yellow-400', CB: 'bg-blue-500/10 text-blue-400',
  LB: 'bg-blue-500/10 text-blue-400', RB: 'bg-blue-500/10 text-blue-400',
  CDM: 'bg-green-500/10 text-green-400', CM: 'bg-green-500/10 text-green-400',
  CAM: 'bg-green-500/10 text-green-400', LW: 'bg-red-500/10 text-red-400',
  RW: 'bg-red-500/10 text-red-400', ST: 'bg-red-500/10 text-red-400',
  CF: 'bg-red-500/10 text-red-400', UNKNOWN: 'bg-slate-500/10 text-slate-400',
}

export function SquadTable({ clubId }: { clubId: number }) {
  const { data, isLoading } = useSquad(clubId)
  const { isSportDirector } = useAuthStore()
  const isSD = isSportDirector()
  const [search, setSearch] = useState('')

  if (isLoading) return <PageSpinner />

  const filtered = (data || []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.position.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Squad ({data?.length || 0} players)</CardTitle>
        <div className="w-48">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter players..."
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Player</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Pos</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Age</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Contract</th>
                {isSD && <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Salary / yr</th>}
                {isSD && <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Amort / yr</th>}
                {isSD && <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Source</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map(p => {
                const expiresIn = p.contract_expiry_year - 2025
                return (
                  <tr key={p.player_id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.name} className="w-8 h-8 rounded-full object-cover bg-slate-700" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                            {p.name[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-slate-200 text-sm">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.nationality || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${positionColor[p.position] || positionColor.UNKNOWN}`}>
                        {p.position}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-400">{p.age}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs font-medium ${expiresIn <= 1 ? 'text-red-400' : expiresIn <= 2 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {p.contract_expiry_year || '—'}
                      </span>
                    </td>
                    {isSD && <td className="px-6 py-3 text-slate-300 font-medium">{p.annual_salary != null ? formatEur(p.annual_salary, true) : '—'}</td>}
                    {isSD && <td className="px-6 py-3 text-slate-400">{p.amortization_per_year != null ? formatEur(p.amortization_per_year, true) : '—'}</td>}
                    {isSD && <td className="px-6 py-3"><Badge variant={p.data_source === 'override' ? 'success' : 'outline'} className="text-xs">{p.data_source || '—'}</Badge></td>}
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500 text-sm">No players found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
