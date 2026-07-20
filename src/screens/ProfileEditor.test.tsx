import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../api/profiles', async (orig) => ({
  ...(await orig<typeof import('../api/profiles')>()),
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
  listLlmOptions: vi.fn(),
}))
vi.mock('../api/tts', () => ({ listTtsProfiles: vi.fn() }))

import { createProfile, updateProfile, listLlmOptions } from '../api/profiles'
import { listTtsProfiles } from '../api/tts'
import { ProfileEditor } from './ProfileEditor'
import { emptyProfileInput, toEditableInput } from './profileForm'

beforeEach(() => {
  // The brief's test cases share module-level vi.fn() mocks across `it`
  // blocks in this file; without clearing, call history (and thus
  // `.not.toHaveBeenCalled()` / `.mock.calls[0]` assertions) leaks between
  // tests since this project's vitest.config.ts sets neither clearMocks nor
  // restoreMocks. Clear first so each test's mock state starts empty.
  vi.clearAllMocks()
  vi.mocked(listLlmOptions).mockResolvedValue([])
  vi.mocked(listTtsProfiles).mockResolvedValue([])
  vi.mocked(createProfile).mockResolvedValue({} as never)
  vi.mocked(updateProfile).mockResolvedValue({} as never)
})

it('create mode: New profile calls createProfile with the entered name', async () => {
  const onDone = vi.fn()
  render(<ProfileEditor mode="create" initial={emptyProfileInput()} onDone={onDone} onCancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'my-bot' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(createProfile).toHaveBeenCalled())
  expect(vi.mocked(createProfile).mock.calls[0][0].name).toBe('my-bot')
  await waitFor(() => expect(onDone).toHaveBeenCalled())
})

it('edit mode: name is readonly and api_key is never sent as ***', async () => {
  const loaded = toEditableInput({
    ...emptyProfileInput(), owner_id: 'u1',
    llm: { base_url: '', api_key: '***', model: 'gpt', engine: 'openai' },
    name: 'mine',
  } as never)
  render(<ProfileEditor mode="edit" initial={loaded} onDone={() => {}} onCancel={() => {}} />)
  expect((screen.getByLabelText('Name') as HTMLInputElement).readOnly).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(updateProfile).toHaveBeenCalled())
  expect(vi.mocked(updateProfile).mock.calls[0][1].llm.api_key).toBe('') // blank, not ***
})

it('adds and removes MCP server rows', async () => {
  render(<ProfileEditor mode="create" initial={emptyProfileInput()} onDone={() => {}} onCancel={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add MCP server' }))
  expect(screen.getByLabelText('MCP server 1 name')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Remove MCP server 1' }))
  expect(screen.queryByLabelText('MCP server 1 name')).toBeNull()
})

it('blocks save and shows an error when MCP headers JSON is invalid', async () => {
  render(<ProfileEditor mode="create" initial={emptyProfileInput()} onDone={() => {}} onCancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add MCP server' }))
  fireEvent.change(screen.getByLabelText('MCP server 1 headers (JSON)'), { target: { value: 'not json' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(createProfile).not.toHaveBeenCalled()
})

it('surfaces a server error on save', async () => {
  vi.mocked(createProfile).mockRejectedValue(new Error('That name is already taken.'))
  render(<ProfileEditor mode="create" initial={emptyProfileInput()} onDone={() => {}} onCancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'dup' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText(/already taken/i)).toBeTruthy()
})

it('LLM model select: selecting an option sets engine/model and blanks base_url/api_key', async () => {
  vi.mocked(listLlmOptions).mockResolvedValue([
    { engine: 'openai', model_id: 'gpt-4o', label: 'OpenAI — GPT-4o' },
  ])
  render(<ProfileEditor mode="create" initial={emptyProfileInput()} onDone={() => {}} onCancel={() => {}} />)
  await screen.findByText('OpenAI — GPT-4o')
  fireEvent.change(screen.getByLabelText('LLM model'), { target: { value: 'openai|gpt-4o' } })
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(createProfile).toHaveBeenCalled())
  const payload = vi.mocked(createProfile).mock.calls[0][0]
  expect(payload.llm).toEqual({ engine: 'openai', model: 'gpt-4o', base_url: '', api_key: '' })
})

it('LLM model select shows a disabled placeholder when no options are available', async () => {
  render(<ProfileEditor mode="create" initial={emptyProfileInput()} onDone={() => {}} onCancel={() => {}} />)
  await waitFor(() => expect(listLlmOptions).toHaveBeenCalled())
  const opt = screen.getByText('(no LLM models — add one in Model Registry)') as HTMLOptionElement
  expect(opt.disabled).toBe(true)
})

it('preselects an existing (unavailable) LLM choice not present in llmOptions', async () => {
  const loaded = toEditableInput({
    ...emptyProfileInput(), owner_id: 'u1',
    llm: { base_url: '', api_key: '***', model: 'gpt', engine: 'openai' },
    name: 'mine',
  } as never)
  render(<ProfileEditor mode="edit" initial={loaded} onDone={() => {}} onCancel={() => {}} />)
  await waitFor(() => expect(listLlmOptions).toHaveBeenCalled())
  expect((screen.getByLabelText('LLM model') as HTMLSelectElement).value).toBe('openai|gpt')
})
