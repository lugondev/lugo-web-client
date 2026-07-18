import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders its label and forwards onClick handler shape', () => {
    render(<Button variant="primary">Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('applies the variant class', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole('button').className).toContain('btn--danger')
  })

  it('disabled forwards to the element', () => {
    render(<Button variant="primary" disabled>X</Button>)
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('defaults type to button, not submit', () => {
    // A stray submit inside a form would submit it. Default must be safe.
    render(<Button variant="secondary">Cancel</Button>)
    expect((screen.getByRole('button') as HTMLButtonElement).type).toBe('button')
  })
})
