import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMyUsage } from './usage'
import { saveTokens } from './tokens'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ROW = {
  kind: 'llm',
  model_id: 'gpt-4o-mini',
  cost_usd: 0.1234,
  native_amount: 5000,
  count: 7,
}

describe('usage api', () => {
  beforeEach(() => {
    localStorage.clear()
    saveTokens('acc', 'ref')
    vi.restoreAllMocks()
  })

  it('getMyUsage returns an array of usage rows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [ROW] })))
    const rows = await getMyUsage()
    expect(rows).toHaveLength(1)
    expect(rows[0].model_id).toBe('gpt-4o-mini')
  })

  it('getMyUsage hits /v1/usage/me', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', f)
    await getMyUsage()
    expect(String(f.mock.calls[0][0])).toContain('/v1/usage/me')
  })

  it('getMyUsage attaches bearer (i.e. goes through apiFetch)', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', f)
    await getMyUsage()
    expect(new Headers(f.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer acc')
  })

  it('getMyUsage passes an encoded period as a query param', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', f)
    await getMyUsage('2026-07')
    expect(String(f.mock.calls[0][0])).toContain('period=2026-07')
  })

  it('getMyUsage omits the query param when no period is given', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', f)
    await getMyUsage()
    expect(String(f.mock.calls[0][0])).not.toContain('period=')
  })

  it('getMyUsage throws when the server rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'nope' }, 500)))
    await expect(getMyUsage()).rejects.toThrow()
  })

  it('getMyUsage defaults to an empty array when data is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true })))
    const rows = await getMyUsage()
    expect(rows).toEqual([])
  })
})
