import React from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; error?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, children, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={cn('tw-input cursor-pointer', error && '!border-red-500/60', className)}
        style={{ background: 'var(--c-bg-raised)' }}
        {...props}
      >{children}</select>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'
