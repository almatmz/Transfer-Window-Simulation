import React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--c-text-3)' }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={cn('tw-input', error && '!border-red-500/60', className)}
        {...props}
      />
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{error}</p>}
      {hint && !error && <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-3)' }}>{hint}</p>}
    </div>
  )
)
Input.displayName = 'Input'
