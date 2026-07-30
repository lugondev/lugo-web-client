import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

describe('History transcript times', () => {
  beforeEach(() => {
    vi.mocked(listSessions).mockReset().mockResolvedValue([ROW] as never)
    vi.mocked(getSession).mockReset()
  })

  it('shows the clock time each message was said at', async () => {
    // Today at 14:32 local -- the screen reads the real clock, and messageTime
    // only omits the date for same-day messages (covered in time.test.ts).
    const d = new Date()
    const said = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 14, 32).toISOString()
    vi.mocked(getSession).mockResolvedValue({
      ...ROW,
      messages: [{ turn: 1, role: 'user', content: 'Hi there', created_at: said }],
    } as never)
    render(<History onContinue={vi.fn()} />)
    fireEvent.click(await screen.findByText('Hello'))
    expect((await screen.findByText('14:32')).className).toContain('his__at')
  })

  it('renders a message with no timestamp without an empty time slot', async () => {
    vi.mocked(getSession).mockResolvedValue({
      ...ROW,
      messages: [{ turn: 1, role: 'user', content: 'Hi there' }],
    } as never)
    render(<History onContinue={vi.fn()} />)
    fireEvent.click(await screen.findByText('Hello'))
    await screen.findByText('Hi there')
    expect(document.querySelector('.his__at')).toBeNull()
    expect(screen.getByText('YOU')).toBeTruthy()
  })
})

describe('History refresh', () => {
  beforeEach(() => {
    // These tests count calls, and the mock is shared across the whole file.
    vi.mocked(listSessions).mockReset().mockResolvedValue([ROW] as never)
  })

  it('re-fetches the list, and shows rows that arrived since', async () => {
    render(<History onContinue={vi.fn()} profile="ada" />)
    await screen.findByText('Hello')
    expect(listSessions).toHaveBeenCalledTimes(1)

    vi.mocked(listSessions).mockResolvedValue([
      { ...ROW, id: 's2', preview: 'Newer' },
      ROW,
    ] as never)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(await screen.findByText('Newer')).toBeTruthy()
    expect(listSessions).toHaveBeenLastCalledWith(50, 0, 'ada')
  })

  it('surfaces a failed refresh without wiping the rows already shown', async () => {
    render(<History onContinue={vi.fn()} />)
    await screen.findByText('Hello')

    vi.mocked(listSessions).mockRejectedValue(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect((await screen.findByRole('alert')).textContent).toBe('offline')
    expect(screen.getByText('Hello')).toBeTruthy()
  })

  it('reloads the open transcript from inside the detail view', async () => {
    vi.mocked(getSession)
      .mockReset()
      .mockResolvedValueOnce({ ...ROW, messages: [{ turn: 1, role: 'user', content: 'Old turn' }] } as never)
    render(<History onContinue={vi.fn()} />)
    fireEvent.click(await screen.findByText('Hello'))
    await screen.findByText('Old turn')

    vi.mocked(getSession).mockResolvedValue({
      ...ROW,
      messages: [
        { turn: 1, role: 'user', content: 'Old turn' },
        { turn: 2, role: 'assistant', content: 'Newer turn' },
      ],
    } as never)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(await screen.findByText('Newer turn')).toBeTruthy()
    expect(getSession).toHaveBeenCalledTimes(2)
    // The list is behind the detail view -- refreshing the transcript must not
    // re-fetch it.
    expect(listSessions).toHaveBeenCalledTimes(1)
  })

  it('cannot be fired twice while a refresh is in flight', async () => {
    let release = () => {}
    vi.mocked(listSessions).mockResolvedValueOnce([ROW] as never)
    render(<History onContinue={vi.fn()} />)
    await screen.findByText('Hello')

    vi.mocked(listSessions).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve([ROW] as never)
      }) as never,
    )
    const btn = screen.getByRole('button', { name: 'Refresh' })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(listSessions).toHaveBeenCalledTimes(2)

    release()
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Refresh' }) as HTMLButtonElement).disabled).toBe(false),
    )
  })
})
