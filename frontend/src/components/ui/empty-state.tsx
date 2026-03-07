import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--c-bg-raised)', border: '1px solid var(--c-border)' }}>
          <Icon className="w-6 h-6 c-text-3" />
        </div>
      )}
      <p className="text-sm font-semibold c-text-2">{title}</p>
      {description && <p className="text-xs c-text-3 mt-1 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
