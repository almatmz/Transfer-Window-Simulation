import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
}

const sizes = {
  xs:  'px-2.5 py-1   text-xs  gap-1   rounded-lg',
  sm:  'px-3   py-1.5 text-xs  gap-1.5 rounded-xl',
  md:  'px-4   py-2   text-sm  gap-2   rounded-xl',
  lg:  'px-6   py-2.5 text-sm  gap-2   rounded-xl',
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: ButtonProps) {
  const variantClass = {
    primary:   'tw-btn tw-btn-primary',
    secondary: 'tw-btn tw-btn-ghost',
    ghost:     'tw-btn tw-btn-ghost border-transparent !shadow-none',
    danger:    'tw-btn tw-btn-danger',
    outline:   'tw-btn tw-btn-ghost',
  }[variant]

  return (
    <button
      className={cn(variantClass, sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
      {children}
    </button>
  )
}
