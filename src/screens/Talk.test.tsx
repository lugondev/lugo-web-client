import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/profiles', () => ({
  listProfiles: vi.fn(),
}))
import { listProfiles } from '../api/profiles'
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
