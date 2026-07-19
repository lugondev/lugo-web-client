import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../api/profiles', async (orig) => ({
  ...(await orig<typeof import('../api/profiles')>()),
  listProfiles: vi.fn(),
  getProfile: vi.fn(),
  deleteProfile: vi.fn(),
  cloneProfile: vi.fn(),
}))
// Editor is exercised in its own test; stub it here to keep this test on the list.
vi.mock('./ProfileEditor', () => ({ ProfileEditor: () => <div>editor</div> }))

import { listProfiles, deleteProfile } from '../api/profiles'
import { Profiles } from './Profiles'

const LLM = { base_url: '', api_key: '', model: 'gpt-4o-mini', engine: 'openai' }
const STT = { engine: 'whisper', language: '', model: '' }
const TTS = { profile_name: '' }
const SHARED = { name: 'esp32', owner_id: null, nickname: 'ESP32', mcp_servers: [], llm: LLM, stt: STT, tts: TTS }
const MINE = { name: 'mine', owner_id: 'u1', nickname: 'Mine', mcp_servers: [], llm: LLM, stt: STT, tts: TTS }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listProfiles).mockResolvedValue([SHARED, MINE] as never)
  vi.mocked(deleteProfile).mockResolvedValue(undefined as never)
})

it('groups shared templates (Clone only) and my profiles (Edit/Delete)', async () => {
  render(<Profiles />)
  await screen.findByText('ESP32')
  // shared row: a Clone action, no Delete
  const shared = screen.getByText('ESP32').closest('.profiles__row') as HTMLElement
  expect(shared.querySelector('[data-act="clone"]')).toBeTruthy()
  expect(shared.querySelector('[data-act="delete"]')).toBeNull()
  // mine row: Edit + Delete
  const mine = screen.getByText('Mine').closest('.profiles__row') as HTMLElement
  expect(mine.querySelector('[data-act="edit"]')).toBeTruthy()
  expect(mine.querySelector('[data-act="delete"]')).toBeTruthy()
})

it('deletes my profile after confirming', async () => {
  render(<Profiles />)
  const mine = (await screen.findByText('Mine')).closest('.profiles__row') as HTMLElement
  fireEvent.click(mine.querySelector('[data-act="delete"]') as HTMLElement)
  // ConfirmModal's confirm label is unique ("Yes, delete") so it does not
  // collide with the row's own "Delete" button.
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, delete' }))
  await waitFor(() => expect(deleteProfile).toHaveBeenCalledWith('mine'))
})
