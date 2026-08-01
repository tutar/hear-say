import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: string
  children: ReactNode
  cancelLabel: string
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ eyebrow, title, children, cancelLabel, confirmLabel, danger = false, onCancel, onConfirm }: Props) {
  const cancelButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { cancelButton.current?.focus() }, [])
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onKeyDown={(event) => { if (event.key === 'Escape') onCancel() }}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h3 id="confirm-dialog-title">{title}</h3>
      <div className="dialog-copy">{children}</div>
      <div className="dialog-actions">
        <button ref={cancelButton} className="dialog-secondary" type="button" onClick={onCancel}>{cancelLabel}</button>
        <button className={danger ? 'dialog-danger' : 'dialog-primary'} type="button" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </section>
  </div>
}
