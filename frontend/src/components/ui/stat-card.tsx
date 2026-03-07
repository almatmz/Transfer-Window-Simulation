import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string; value: string | number; sub?: string
  icon?: LucideIcon; accent?: 'blue'|'emerald'|'amber'|'red'|'purple'; className?: string
}

const iconClasses: Record<string, string> = {
  blue:    'text-blue-500 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10',
  emerald: 'text-emerald-500 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
  amber:   'text-amber-500 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
  red:     'text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-500/10',
  purple:  'text-purple-500 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10',
}

export function StatCard({ label, value, sub, icon: Icon, accent = 'blue', className }: StatCardProps) {
  return (
    <div className={cn('tw-card p-5 group', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2 c-text-3">{label}</p>
          <p className="text-2xl font-bold tabular-nums leading-none truncate c-text">{value}</p>
          {sub && <p className="text-xs mt-1.5 c-text-3">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn('p-2.5 rounded-xl flex-shrink-0 transition-transform group-hover:scale-110', iconClasses[accent])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  )
}
