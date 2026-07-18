import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cloneProfile, createProfile, deleteProfile, getProfile,
  listLlmOptions, listProfiles, updateProfile,
} from './profiles'
import { saveTokens } from './tokens'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

const SHARED = { name: 'esp32', owner_id: null, nickname: 'ESP32' }
const MINE = { name: 'mine', owner_id: 'u1', nickname: '' }

describe('profiles api', () => {
  beforeEach(() => {
    localStorage.clear()
    saveTokens('acc', 'ref')
    vi.restoreAllMocks()
  })

  it('listProfiles turns the name-keyed dict into a sorted array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { mine: MINE, esp32: SHARED } })))
    const list = await listProfiles()
    expect(list.map((p) => p.name)).toEqual(['esp32', 'mine']) // sorted by nickname||name
    expect(list.find((p) => p.name === 'esp32')?.owner_id).toBeNull()
  })

  it('listProfiles goes through apiFetch (bearer attached)', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} }))
    vi.stubGlobal('fetch', f)
    await listProfiles()
    expect(new Headers(f.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer acc')
  })

  it('createProfile POSTs the payload and returns the created profile', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: MINE }))
    vi.stubGlobal('fetch', f)
    const p = await createProfile({ name: 'mine' } as never)
    expect(f.mock.calls[0][0]).toContain('/v1/profiles')
    expect(f.mock.calls[0][1].method).toBe('POST')
    expect(p.name).toBe('mine')
  })

  it('updateProfile PUTs to the name path', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: MINE }))
    vi.stubGlobal('fetch', f)
    await updateProfile('mine', { name: 'mine' } as never)
    expect(f.mock.calls[0][0]).toContain('/v1/profiles/mine')
    expect(f.mock.calls[0][1].method).toBe('PUT')
  })

  it('deleteProfile DELETEs the name path', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal('fetch', f)
    await deleteProfile('mine')
    expect(f.mock.calls[0][0]).toContain('/v1/profiles/mine')
    expect(f.mock.calls[0][1].method).toBe('DELETE')
  })

  it('cloneProfile POSTs new_name to the clone path', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: MINE }))
    vi.stubGlobal('fetch', f)
    await cloneProfile('esp32', 'mine')
    expect(f.mock.calls[0][0]).toContain('/v1/profiles/esp32/clone')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ new_name: 'mine' })
  })

  it('getProfile returns the single profile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true, data: MINE })))
    expect((await getProfile('mine')).name).toBe('mine')
  })

  it('listLlmOptions returns the options array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      success: true, data: [{ id: 'x', engine: 'openai', model_id: 'gpt', label: 'GPT' }],
    })))
    expect((await listLlmOptions())[0].engine).toBe('openai')
  })

  it('surfaces the server error text; maps 409 to a name-taken message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ detail: "'mine' already exists" }, 409)))
    await expect(createProfile({ name: 'mine' } as never)).rejects.toThrow(/already exists|taken/i)
  })

  it('surfaces FastAPI 422 validation errors (detail is an array of {loc,msg,type})', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        detail: [{ loc: ['body', 'llm', 'base_url'], msg: 'field required', type: 'value_error' }],
      }, 422)))
    await expect(createProfile({ name: 'mine' } as never)).rejects.toThrow(/field required/)
  })
})
