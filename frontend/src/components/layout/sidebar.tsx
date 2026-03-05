'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { LayoutDashboard, Search, Activity, TrendingUp, User, Shield, LogOut, Trophy, Menu, X, ChevronRight } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clubs', label: 'Clubs', icon: Search },
  { href: '/simulations', label: 'Simulations', icon: Activity },
  { href: '/ffp', label: 'FFP Analyzer', icon: TrendingUp },
  { href: '/profile', label: 'Profile', icon: User },
]

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutDashboard; active: boolean }) {
  return (
    <Link href={href} className={cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
      active ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-900/10' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
    )}>
      <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400')} />
      {label}
      {active && <ChevronRight className="w-3 h-3 ml-auto text-blue-500/60" />}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout, isAdmin } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg shadow-blue-900/30">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100 tracking-tight">TW Simulator</p>
            <p className="text-xs text-slate-600">Financial FFP Tool</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Main</p>
        {navItems.map(item => (
          <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
        ))}
        {isAdmin() && (
          <>
            <p className="px-3 mt-4 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">System</p>
            <NavLink href="/admin" label="Admin Panel" icon={Shield} active={pathname.startsWith('/admin')} />
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-800/60">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl bg-slate-800/30">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-lg">
              {(user.full_name || user.username)[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user.full_name || user.username}</p>
              <p className="text-[11px] text-slate-500 capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all w-full">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button onClick={() => setMobileOpen(true)} className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-slate-900 border border-slate-800">
        <Menu className="w-5 h-5 text-slate-400" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-slate-950 border-r border-slate-800">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-950 border-r border-slate-800/60 min-h-screen fixed left-0 top-0 z-30">
        {sidebarContent}
      </aside>
    </>
  )
}
