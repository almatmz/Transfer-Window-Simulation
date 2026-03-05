'use client'
import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useClubSearch } from '@/services/queries'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Search, TrendingUp, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Spinner } from '@/components/ui/spinner'

export default function FFPListPage() {
  const [query, setQuery] = useState('')
  const { data, isLoading } = useClubSearch(query)

  return (
    <AppLayout title="FFP Analyzer">
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100 mb-1">FFP Analyzer</h2>
          <p className="text-slate-500 text-sm">Search a club to view their UEFA Financial Fair Play dashboard.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search club — e.g. Real Madrid, Arsenal..."
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          {isLoading && <Spinner className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4" />}
        </div>
        {data?.map(club => (
          <Link key={club.api_football_id} href={`/ffp/${club.api_football_id}`}>
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group cursor-pointer mt-2">
              <div className="flex items-center gap-3">
                {club.logo_url && <img src={club.logo_url} alt="" className="w-8 h-8 object-contain" />}
                <div>
                  <p className="font-semibold text-slate-200 group-hover:text-white">{club.name}</p>
                  <p className="text-xs text-slate-500">{club.country}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost"><TrendingUp className="w-3.5 h-3.5" /> Analyze</Button>
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </div>
            </div>
          </Link>
        ))}
        {!query && <EmptyState icon={TrendingUp} title="Search for a club to view FFP analysis" />}
      </div>
    </AppLayout>
  )
}
