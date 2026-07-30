import { useEffect, useId, useRef, type ReactNode } from 'react'
import './ui.css'

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Escape has to call the CURRENT onClose, but onClose must not be a dependency
  // of the effect below: callers pass an inline arrow, so its identity changes on
  // every parent render -- including the render that typing into a field inside
  // the modal causes. With onClose in the dependency list the effect tore down
  // and set up again on each keystroke, and its setup moves focus to the first
  // focusable element, so the caret jumped out of the field being typed in and
  // back to the first one. Reading it from a ref keeps the handler fresh while
  // the effect runs only when the modal actually opens or closes.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return

    // Return focus to where it was on close: keyboard users don't "lose their place".
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Move focus into the dialog. Prefer the first focusable element, otherwise the
    // dialog itself (it has tabIndex=-1).
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
    )
    ;(focusables && focusables.length ? focusables[0] : dialogRef.current)?.focus()

    // Lock background scroll.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      // Focus trap: keep Tab cycling within the dialog.
      const items = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      if (!items || items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="modal__backdrop"
      data-testid="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
        // A click inside must not reach the backdrop (the backdrop closes the modal).
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
