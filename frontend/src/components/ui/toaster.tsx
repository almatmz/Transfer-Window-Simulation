'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { Toast, ToastType } from '@/hooks/use-toast'

let _listeners: Array<(toasts: Toast[]) => void> = []
let _toasts: Toast[] = []

export function toast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).slice(2)
  _toasts = [..._toasts, { id, message, type }]
  _listeners.forEach(l => l([..._toasts]))
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id)
    _listeners.forEach(l => l([..._toasts]))
  }, 4000)
}

const icons = {
  success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info,
}
const styles = {
  success: 'border-emerald-500/30 bg-emerald-950/80 text-emerald-300',
  error: 'border-red-500/30 bg-red-950/80 text-red-300',
  warning: 'border-amber-500/30 bg-amber-950/80 text-amber-300',
  info: 'border-blue-500/30 bg-blue-950/80 text-blue-300',
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => {
    _listeners.push(setToasts)
    return () => { _listeners = _listeners.filter(l => l !== setToasts) }
  }, [])

  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(t => {
        const Icon = icons[t.type]
        return (
          <div key={t.id} className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-xl text-sm font-medium animate-in slide-in-from-right-5', styles[t.type])}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <p className="flex-1">{t.message}</p>
            <button onClick={() => { _toasts = _toasts.filter(x => x.id !== t.id); _listeners.forEach(l => l([..._toasts])) }}>
              <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
