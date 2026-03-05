'use client'
import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { useClubSearch } from '@/services/queries'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Search, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function ClubsPage() {
  const [query, setQuery] = useState('')
  const { data, isLoading } = useClubSearch(query)

  return (
    <AppLayout title="Search Clubs">
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100 mb-1">Find a Club</h2>
          <p className="text-slate-500 text-sm">Search any club to load their squad and FFP analysis.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clubs — e.g. Manchester, Real Madrid, Bayern..."
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
          {isLoading && <Spinner className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4" />}
        </div>

        {data && data.length > 0 && (
          <div className="space-y-2">
            {data.map(club => (
              <Link key={club.api_football_id} href={`/clubs/${club.api_football_id}`}>
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/50 transition-all group cursor-pointer">
                  <div className="flex items-center gap-4">
                    {club.logo_url ? (
                      <img src={club.logo_url} alt={club.name} className="w-10 h-10 object-contain" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400">
                        {club.name[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-200 group-hover:text-white">{club.name}</p>
                      <p className="text-xs text-slate-500">{club.country}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {data && data.length === 0 && query.length >= 2 && (
          <p className="text-center text-slate-500 text-sm py-8">No clubs found for "{query}"</p>
        )}

        {!query && (
          <div className="text-center py-8 text-slate-500 text-sm">Type at least 2 characters to search</div>
        )}
      </div>
    </AppLayout>
  )
}
