import { cn } from '@/lib/utils'
import { Card, CardContent } from './card'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string; value: string | number; sub?: string
  icon?: LucideIcon; trend?: 'up' | 'down' | 'neutral'; className?: string
  accent?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple'
}

const accents = {
  blue: 'text-blue-400 bg-blue-500/10', emerald: 'text-emerald-400 bg-emerald-500/10',
  amber: 'text-amber-400 bg-amber-500/10', red: 'text-red-400 bg-red-500/10',
  purple: 'text-purple-400 bg-purple-500/10',
}

export function StatCard({ label, value, sub, icon: Icon, accent = 'blue', className }: StatCardProps) {
  return (
    <Card className={cn('hover:border-slate-700 transition-colors', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-100 truncate">{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
          </div>
          {Icon && (
            <div className={cn('p-2.5 rounded-lg ml-3 flex-shrink-0', accents[accent])}>
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
