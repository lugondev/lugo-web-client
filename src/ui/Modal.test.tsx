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
})
