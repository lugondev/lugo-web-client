import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listSttModelOptions } from './stt'
import { saveTokens } from './tokens'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('stt api', () => {
  beforeEach(() => { localStorage.clear(); saveTokens('acc', 'ref'); vi.restoreAllMocks() })

  it('listSttModelOptions maps the registry options to {engine, model, label} with exactly one request', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({
      success: true, data: [{ engine: 'whisper', model_id: 'tiny', label: 'whisper — Tiny' }],
    }))
    vi.stubGlobal('fetch', f)
    const opts = await listSttModelOptions()
    expect(opts).toEqual([{ engine: 'whisper', model: 'tiny', label: 'whisper — Tiny' }])
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls[0][0]).toContain('/v1/model_registry/options?kind=stt')
  })

  it('hits /v1/model_registry/options through apiFetch (bearer attached)', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', f)
    await listSttModelOptions()
    expect(new Headers(f.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer acc')
  })
})
