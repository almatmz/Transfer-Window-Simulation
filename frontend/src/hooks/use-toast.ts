import { useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

// Global singleton store outside React for cross-component use
let _toasts: Toast[] = []
let _listeners: Array<(toasts: Toast[]) => void> = []

function notify() { _listeners.forEach(l => l([..._toasts])) }

export function toast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).slice(2)
  _toasts = [..._toasts, { id, message, type }]
  notify()
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id)
    notify()
  }, 4000)
}

export function useToastStore() {
  const [toasts, setToasts] = useState<Toast[]>(_toasts)
  useCallback(() => {
    _listeners.push(setToasts)
    return () => { _listeners = _listeners.filter(l => l !== setToasts) }
  }, [])()
  return toasts
}
