'use client'
import { useAuthStore } from '@/store/auth'
import { Badge } from '@/components/ui/badge'
import { Bell } from 'lucide-react'
import Link from 'next/link'

const roleBadge: Record<string, 'info' | 'success' | 'warning'> = {
  admin: 'warning', sport_director: 'success', user: 'info',
}

export function Topbar({ title }: { title?: string }) {
  const { user } = useAuthStore()
  return (
    <header className="h-14 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-20 lg:ml-64">
      <h1 className="text-sm font-semibold text-slate-300 pl-10 lg:pl-0">{title}</h1>
      <div className="flex items-center gap-3">
        <button className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-all">
          <Bell className="w-4 h-4" />
        </button>
        {user && (
          <Link href="/profile">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-800 transition-all cursor-pointer">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                {(user.full_name || user.username)[0]?.toUpperCase()}
              </div>
              <Badge variant={roleBadge[user.role] || 'info'} className="hidden sm:flex">
                {user.role.replace('_', ' ')}
              </Badge>
            </div>
          </Link>
        )}
      </div>
    </header>
  )
}
