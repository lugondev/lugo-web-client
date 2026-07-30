import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={() => {}} title="X">body</Modal>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('is a labelled modal dialog when open', () => {
    render(<Modal open onClose={() => {}} title="Remove device">body</Modal>)
    const dlg = screen.getByRole('dialog')
    expect(dlg.getAttribute('aria-modal')).toBe('true')
    // title is wired via aria-labelledby, not just visually present
    const labelledby = dlg.getAttribute('aria-labelledby')
    expect(labelledby).toBeTruthy()
    expect(document.getElementById(labelledby!)?.textContent).toBe('Remove device')
  })

  it('Escape closes it', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="X">body</Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking the backdrop closes it', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="X">body</Modal>)
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking INSIDE the dialog does NOT close it', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="X"><button>inside</button></Modal>)
    fireEvent.click(screen.getByRole('button', { name: 'inside' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('moves focus into the dialog on open', () => {
    render(<Modal open onClose={() => {}} title="X"><button>act</button></Modal>)
    // focus should be within the dialog, not left on <body>
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('does not steal focus back to the first field when the parent re-renders', () => {
    // A parent almost always passes an inline arrow as onClose, so its identity
    // changes on every render -- including the render caused by typing into a
    // field inside the modal. If that re-runs the focus effect, the caret jumps
    // out of whatever the user is typing in and back to the first input, one
    // character at a time (PairWizard: every keystroke in "Device name" landed
    // back in the code box).
    const { rerender } = render(
      <Modal open onClose={() => {}} title="X">
        <input aria-label="first" />
        <input aria-label="second" />
      </Modal>,
    )
    const second = screen.getByLabelText('second')
    second.focus()

    rerender(
      <Modal open onClose={() => {}} title="X">
        <input aria-label="first" />
        <input aria-label="second" />
      </Modal>,
    )

    expect(document.activeElement).toBe(second)
  })
})
