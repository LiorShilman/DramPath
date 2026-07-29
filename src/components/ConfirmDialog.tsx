import { useEffect, useRef } from 'react'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

// Plain overlay rather than native <dialog>/showModal() — jsdom (our test
// environment) doesn't implement HTMLDialogElement.showModal(), and this
// stays just as accessible (role="alertdialog", Escape to close, focus
// moved to Cancel on open) without an environment-specific gap.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'מחיקה',
  cancelLabel = 'ביטול',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="flex w-full max-w-sm flex-col gap-3 rounded-[var(--radius-card)] bg-[var(--color-bg)] p-4 shadow-lg"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-1.5 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[var(--radius-card)] bg-[var(--color-danger)] px-3 py-1.5 text-sm text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
