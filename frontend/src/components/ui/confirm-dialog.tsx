'use client'
import { Modal } from './modal'
import { Button } from './button'

interface Props { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel?: string; loading?: boolean }

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', loading }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm mb-6 c-text-2 leading-relaxed">{message}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose} size="sm">Cancel</Button>
        <Button variant="danger" loading={loading} onClick={onConfirm} size="sm">{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
