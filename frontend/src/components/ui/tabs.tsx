'use client'
import { cn } from '@/lib/utils'

interface TabsProps { tabs: string[]; active: string; onChange: (t: string) => void; className?: string }

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex', className)} style={{ borderBottom: '1px solid var(--c-border)' }}>
      {tabs.map(tab => (
        <button key={tab} onClick={() => onChange(tab)}
          className={cn(
            'px-5 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
            active === tab
              ? 'border-blue-500 text-blue-500 dark:text-blue-400'
              : 'border-transparent c-text-2 hover:c-text hover:border-slate-300 dark:hover:border-slate-600'
          )}>
          {tab}
        </button>
      ))}
    </div>
  )
}
