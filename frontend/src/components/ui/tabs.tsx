'use client'
import { cn } from '@/lib/utils'

interface TabsProps {
  tabs: string[]
  active: string
  onChange: (tab: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-0 border-b border-slate-800', className)}>
      {tabs.map(tab => (
        <button key={tab} onClick={() => onChange(tab)}
          className={cn('px-5 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
            active === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600')}>
          {tab}
        </button>
      ))}
    </div>
  )
}
