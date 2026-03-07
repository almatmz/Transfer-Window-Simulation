import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('w-5 h-5 rounded-full border-2 animate-spin', className)}
      style={{ borderColor: 'var(--c-border-mid)', borderTopColor: 'var(--c-accent)' }} />
  )
}

export function PageSpinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
      <Spinner className="w-8 h-8" />
      <p className="text-xs animate-pulse" style={{ color: 'var(--c-text-3)' }}>Loading...</p>
    </div>
  )
}
