import { useEffect, useRef, useState } from 'react'
import './ui.css'

export type MenuItem = {
  label: string
  onSelect: () => void
  /** Renders in the danger colour and sits last. For actions that destroy data. */
  destructive?: boolean
}

/** An overflow ("⋯") menu.
 *
 * Exists so destructive actions stop sitting level with everyday ones: a Delete
 * button the same size and in the same row as Configure invites the mis-click it
 * cannot undo. One deliberate extra tap is the point, not an oversight.
 */
export function MenuButton({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        // Escape must land the user back on the trigger, not nowhere.
        rootRef.current?.querySelector('button')?.focus()
      }
    }
    // `mousedown`, not `click`: a click that closes the menu would otherwise also
    // reach whatever is underneath it.
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        className="menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="menu__list" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`menu__item${item.destructive ? ' menu__item--danger' : ''}`}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
