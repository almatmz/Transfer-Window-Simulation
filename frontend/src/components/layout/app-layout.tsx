'use client'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  className?: string
}

export function AppLayout({ children, title, className }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Topbar title={title} />
        <main className={cn('flex-1 p-4 sm:p-6 max-w-[1400px]', className)}>
          {children}
        </main>
      </div>
    </div>
  )
}
