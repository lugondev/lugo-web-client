import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/history', () => ({
  listSessions: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
}))
import { getSession, listSessions } from '../api/history'
import { History } from './History'

const ROW = {
  id: 's1', profile_id: 'p', user_id: null, created_at: '2026-07-17T10:00:00Z',
  ended_at: null, meta: {}, message_count: 2, preview: 'Hello',
}

describe('History continue', () => {
  beforeEach(() => {
    vi.mocked(listSessions).mockResolvedValue([ROW] as never)
  })

  it('calls onContinue with the row id, without opening the detail view', async () => {
    const onContinue = vi.fn()
    render(<History onContinue={onContinue} />)
    fireEvent.click(await screen.findByText('Continue'))
    expect(onContinue).toHaveBeenCalledWith('s1')
    expect(screen.queryByText('Back')).toBeNull()
  })

  it('still opens the detail view when the row itself is tapped', async () => {
    vi.mocked(getSession).mockResolvedValue({ ...ROW, messages: [] } as never)
    render(<History onContinue={vi.fn()} />)
    fireEvent.click(await screen.findByText('Hello'))
    expect(await screen.findByText('Back')).toBeTruthy()
  })

  it('detail view also has a Continue button that calls onContinue', async () => {
    vi.mocked(getSession).mockResolvedValue({ ...ROW, messages: [] } as never)
    const onContinue = vi.fn()
    render(<History onContinue={onContinue} />)
    fireEvent.click(await screen.findByText('Hello'))
    fireEvent.click(await screen.findByText('Continue'))
    expect(onContinue).toHaveBeenCalledWith('s1')
  })
})
