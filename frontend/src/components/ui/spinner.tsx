import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-blue-400', className)} />
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Spinner className="w-8 h-8" />
    </div>
  )
}
