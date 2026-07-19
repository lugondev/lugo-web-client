import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/profiles', () => ({
  listProfiles: vi.fn(),
}))
vi.mock('../api/history', () => ({
  listSessions: vi.fn(),
}))
vi.mock('../audio/conversation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../audio/conversation')>()
  return { ...actual, Conversation: vi.fn() }
})
import { listSessions } from '../api/history'
import { listProfiles } from '../api/profiles'
import { Conversation } from '../audio/conversation'
import { Talk } from './Talk'
import { PROFILE_KEY } from './talkProfile'

const LIST = [
  { name: 'esp32', owner_id: null, nickname: 'ESP32' },
  { name: 'rpi', owner_id: null, nickname: 'RPI' },
]

describe('Talk profile picker', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(listProfiles).mockResolvedValue(LIST as never)
  })

  it('auto-selects the first profile when nothing is saved', async () => {
    render(<Talk />)
    const select = (await screen.findByLabelText('Assistant')) as HTMLSelectElement
    expect(select.value).toBe('esp32')
  })

  it('restores the saved selection', async () => {
    localStorage.setItem(PROFILE_KEY, 'rpi')
    render(<Talk />)
    const select = (await screen.findByLabelText('Assistant')) as HTMLSelectElement
    expect(select.value).toBe('rpi')
  })

  it('persists the selection on change', async () => {
    render(<Talk />)
    const select = (await screen.findByLabelText('Assistant')) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'rpi' } })
    expect(localStorage.getItem(PROFILE_KEY)).toBe('rpi')
  })

  it('shows no dropdown when the list is empty', async () => {
    vi.mocked(listProfiles).mockResolvedValue([] as never)
    render(<Talk />)
    await waitFor(() => expect(listProfiles).toHaveBeenCalled())
    expect(screen.queryByLabelText('Assistant')).toBeNull()
  })
})

describe('Talk session continuity', () => {
  beforeEach(() => {
    // This project's vitest.config.ts sets neither clearMocks nor
    // restoreMocks, so mock.calls (and thus `mock.calls[0]` assertions
    // below) would otherwise leak across `it` blocks -- see the same note
    // in src/screens/ProfileEditor.test.tsx. Clear first.
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(listProfiles).mockResolvedValue([] as never)
    // Need enough "capability" that start() doesn't branch into the 'error'
    // state before reaching the session logic -- see src/audio/capability.test.ts.
    vi.stubGlobal('AudioDecoder', class {})
    vi.stubGlobal('AudioContext', class {})
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => {} } })
    // A `function` (not an arrow function) so `new Conversation(...)` in
    // Talk.tsx can actually construct it -- vi.fn()'s `new` support needs a
    // real constructor for its implementation.
    vi.mocked(Conversation).mockImplementation(
      function () {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn(),
          abort: vi.fn(),
          level: 0,
        } as unknown as Conversation
      },
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('resumes the most recent session when Start talking is pressed with no explicit session', async () => {
    vi.mocked(listSessions).mockResolvedValue([
      { id: 's-latest', profile_id: 'p', user_id: null, created_at: null, ended_at: null, meta: {}, message_count: 1, preview: '' },
    ] as never)
    render(<Talk />)
    fireEvent.click(await screen.findByText('Start talking'))
    await waitFor(() => expect(Conversation).toHaveBeenCalled())
    expect(vi.mocked(Conversation).mock.calls[0][2]).toBe('s-latest')
  })

  it('starts a fresh session when there is no session history', async () => {
    vi.mocked(listSessions).mockResolvedValue([] as never)
    render(<Talk />)
    fireEvent.click(await screen.findByText('Start talking'))
    await waitFor(() => expect(Conversation).toHaveBeenCalled())
    expect(vi.mocked(Conversation).mock.calls[0][2]).toBeUndefined()
  })

  it('still starts when the session lookup fails', async () => {
    vi.mocked(listSessions).mockRejectedValue(new Error('network down'))
    render(<Talk />)
    fireEvent.click(await screen.findByText('Start talking'))
    await waitFor(() => expect(Conversation).toHaveBeenCalled())
    expect(vi.mocked(Conversation).mock.calls[0][2]).toBeUndefined()
  })

  it('auto-connects to an explicit session on mount and skips the lookup entirely', async () => {
    const onResumed = vi.fn()
    render(<Talk resumeSessionId="s-picked" onResumed={onResumed} />)
    await waitFor(() => expect(Conversation).toHaveBeenCalled())
    expect(vi.mocked(Conversation).mock.calls[0][2]).toBe('s-picked')
    expect(listSessions).not.toHaveBeenCalled()
    await waitFor(() => expect(onResumed).toHaveBeenCalled())
  })
})
