import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../api/profiles', async (orig) => ({
  ...(await orig<typeof import('../api/profiles')>()),
  listProfiles: vi.fn(),
  getProfile: vi.fn(),
  deleteProfile: vi.fn(),
  cloneProfile: vi.fn(),
  listLlmOptions: vi.fn(),
}))
vi.mock('../api/tts', () => ({ listTtsProfiles: vi.fn() }))
vi.mock('../api/devices', () => ({ listDevices: vi.fn() }))
vi.mock('../api/history', () => ({ listSessions: vi.fn() }))
// Editor is exercised in its own test; stub it here to keep this test on the list.
vi.mock('./ProfileEditor', () => ({ ProfileEditor: () => <div>editor</div> }))

import { listProfiles, deleteProfile, listLlmOptions } from '../api/profiles'
import { listDevices } from '../api/devices'
import { listSessions } from '../api/history'
import { listTtsProfiles } from '../api/tts'
import { Profiles } from './Profiles'

const LLM = { base_url: '', api_key: '', model: 'gpt-4o-mini', engine: 'openai' }
const STT = { engine: 'openai_stt', language: '', model: 'Qwen/Qwen3-ASR-0.6B' }
const TTS = { profile_name: 'vn-cf' }
const SHARED = { name: 'esp32', owner_id: null, nickname: 'ESP32', mcp_servers: [], llm: LLM, stt: STT, tts: TTS }
const MINE = { name: 'mine', owner_id: 'u1', nickname: 'Mine', mcp_servers: [], llm: LLM, stt: STT, tts: TTS }

function device(over: Record<string, unknown> = {}) {
  return {
    id: 'd1', user_id: 'u1', name: 'Kitchen', serial: 'S1', profile_id: 'mine',
    created_at: null, last_seen_at: null, revoked: false, ...over,
  }
}

const noop = () => {}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listProfiles).mockResolvedValue([SHARED, MINE] as never)
  vi.mocked(deleteProfile).mockResolvedValue(undefined as never)
  vi.mocked(listDevices).mockResolvedValue([] as never)
  vi.mocked(listSessions).mockResolvedValue([] as never)
  vi.mocked(listLlmOptions).mockResolvedValue(
    [{ engine: 'openai', model_id: 'gpt-4o-mini', label: 'OpenAI · GPT-4o mini' }] as never)
  vi.mocked(listTtsProfiles).mockResolvedValue(
    [{ name: 'vn-cf', nickname: 'VieNeu (Cloudflare)' }] as never)
})

function renderHub(over: Partial<Parameters<typeof Profiles>[0]> = {}) {
  return render(<Profiles onOpenDevices={noop} onOpenHistory={noop} {...over} />)
}

/** The card for `title`, found through the heading text it renders. */
function cardOf(title: string): HTMLElement {
  return screen.getByText(title).closest('.pcard') as HTMLElement
}

/** Open a card's overflow menu and return the menu items in it. */
function openMenu(card: HTMLElement): HTMLElement[] {
  fireEvent.click(card.querySelector('.menu__trigger') as HTMLElement)
  return [...card.querySelectorAll('[role="menuitem"]')] as HTMLElement[]
}

it('offers Configure + Delete on my assistants, Duplicate only on shared templates', async () => {
  renderHub()
  await screen.findByText('ESP32')

  const shared = cardOf('ESP32')
  // A template is read-only to a normal user, so Delete would be a button that
  // always fails -- and Configure would open an editor that cannot save.
  expect(shared.querySelector('[data-act="configure"]')).toBeNull()
  expect(openMenu(shared).map((i) => i.textContent)).toEqual(['Duplicate'])

  const mine = cardOf('Mine')
  expect(mine.querySelector('[data-act="configure"]')).toBeTruthy()
  expect(openMenu(mine).map((i) => i.textContent)).toEqual(['Duplicate', 'Delete'])
})

it('keeps Delete out of the everyday button row', async () => {
  renderHub()
  const mine = cardOf(await screen.findByText('Mine').then((el) => el.textContent as string))
  // Everything in the action row is non-destructive; Delete is one deliberate
  // extra tap away, inside the overflow menu.
  const actions = [...mine.querySelectorAll('.pcard__actions button')].map((b) => b.textContent)
  expect(actions).not.toContain('Delete')
})

it('deletes my assistant after confirming', async () => {
  renderHub()
  await screen.findByText('Mine')
  const del = openMenu(cardOf('Mine')).find((i) => i.textContent === 'Delete') as HTMLElement
  fireEvent.click(del)
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, delete' }))
  await waitFor(() => expect(deleteProfile).toHaveBeenCalledWith('mine'))
})

it('warns that deleting unassigns devices rather than revoking them', async () => {
  renderHub()
  await screen.findByText('Mine')
  fireEvent.click(openMenu(cardOf('Mine')).find((i) => i.textContent === 'Delete') as HTMLElement)
  expect(await screen.findByText(/keep their pairing and become unassigned/i)).toBeTruthy()
})

it('shows friendly registry labels only — never the raw engine or model id', async () => {
  renderHub()
  await screen.findByText('Mine')
  const meta = await waitFor(() => {
    const el = cardOf('Mine').querySelector('.pcard__meta') as HTMLElement
    expect(el.textContent).toContain('OpenAI · GPT-4o mini')
    return el
  })
  expect(meta.textContent).toContain('VieNeu (Cloudflare)')
  // The raw engine names and model ids must not leak into the user-facing
  // summary -- only the labels the registry resolved them to.
  expect(meta.textContent).not.toContain('openai_stt')
  expect(meta.textContent).not.toContain('gpt-4o-mini')
  expect(meta.textContent).not.toContain('Qwen/Qwen3-ASR-0.6B')
  expect(meta.textContent).not.toContain('vn-cf')
})

it('counts only this assistant\'s live devices', async () => {
  vi.mocked(listDevices).mockResolvedValue([
    device(),
    device({ id: 'd2', profile_id: 'mine' }),
    device({ id: 'd3', profile_id: 'esp32' }),
    // Revoked hardware is gone, not "one of mine that happens to be off".
    device({ id: 'd4', profile_id: 'mine', revoked: true }),
    device({ id: 'd5', profile_id: '' }),
  ] as never)
  renderHub()
  await screen.findByText('Mine')
  await waitFor(() =>
    expect(cardOf('Mine').querySelector('[data-act="devices"]')?.textContent).toBe('Devices (2)'))
  expect(cardOf('ESP32').querySelector('[data-act="devices"]')?.textContent).toBe('Devices (1)')
})

it('opens the device list for the assistant that was tapped', async () => {
  const onOpenDevices = vi.fn()
  renderHub({ onOpenDevices })
  await screen.findByText('Mine')
  fireEvent.click(cardOf('Mine').querySelector('[data-act="devices"]') as HTMLElement)
  expect(onOpenDevices).toHaveBeenCalledWith('mine')
})

it('opens history with the nickname, not the slug', async () => {
  const onOpenHistory = vi.fn()
  renderHub({ onOpenHistory })
  await screen.findByText('Mine')
  fireEvent.click(cardOf('Mine').querySelector('[data-act="history"]') as HTMLElement)
  // The slug is the store key; the user never chose to see it.
  expect(onOpenHistory).toHaveBeenCalledWith('mine', 'Mine')
})

it('says "not used recently" rather than "never" when the scanned page has no session', async () => {
  renderHub()
  await screen.findByText('Mine')
  // A truncated page cannot establish "never" -- claiming it would be a lie.
  await waitFor(() =>
    expect(cardOf('Mine').querySelector('.pcard__meta')?.textContent)
      .toContain('Not recently'))
})

it('still lists assistants when device and session lookups fail', async () => {
  vi.mocked(listDevices).mockRejectedValue(new Error('boom'))
  vi.mocked(listSessions).mockRejectedValue(new Error('boom'))
  renderHub()
  // Counts and last-used are decoration; losing them must not blank the page.
  expect(await screen.findByText('Mine')).toBeTruthy()
  await waitFor(() =>
    expect(cardOf('Mine').querySelector('[data-act="devices"]')?.textContent).toBe('Devices (0)'))
})
