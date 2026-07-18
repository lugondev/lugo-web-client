import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listTtsProfiles } from './tts'
import { saveTokens } from './tokens'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('tts api', () => {
  beforeEach(() => { localStorage.clear(); saveTokens('acc', 'ref'); vi.restoreAllMocks() })

  it('listTtsProfiles maps the name-keyed dict to a sorted array of names', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      success: true, data: { 'co-host': { nickname: 'Co Host' }, 'nu-tre': {} },
    })))
    const list = await listTtsProfiles()
    expect(list.map((t) => t.name)).toEqual(['co-host', 'nu-tre']) // 'Co Host' < 'nu-tre'
  })

  it('hits /v1/tts/profiles through apiFetch', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} }))
    vi.stubGlobal('fetch', f)
    await listTtsProfiles()
    expect(f.mock.calls[0][0]).toContain('/v1/tts/profiles')
    expect(new Headers(f.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer acc')
  })
})
