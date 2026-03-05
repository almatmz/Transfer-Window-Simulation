import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEur(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(1)}B`
    if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
    if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  }
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function ffpStatusColor(status: string) {
  if (status === 'SAFE' || status === 'OK') return 'text-emerald-400'
  if (status === 'MONITORING' || status === 'WARNING') return 'text-amber-400'
  return 'text-red-400'
}

export function ffpStatusBg(status: string) {
  if (status === 'SAFE' || status === 'OK') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (status === 'MONITORING' || status === 'WARNING') return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  return 'bg-red-500/10 text-red-400 border-red-500/20'
}

export function transferTypeColor(type: string) {
  const map: Record<string, string> = {
    buy: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    sell: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    loan_in: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    loan_out: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }
  return map[type] || 'bg-slate-500/10 text-slate-400'
}
