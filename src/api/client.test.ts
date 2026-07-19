import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, onAuthLost } from './client'
import { getAccessToken, saveTokens } from './tokens'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('attaches Authorization: Bearer from the saved token', async () => {
    saveTokens('acc-1', 'ref-1')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/v1/sessions')

    const headers = new Headers(fetchMock.mock.calls[0][1].headers)
    expect(headers.get('Authorization')).toBe('Bearer acc-1')
  })

  it('NEVER sends cookies', async () => {
    saveTokens('acc-1', 'ref-1')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/v1/sessions')

    // backend disables allow_credentials; sending cookies only makes the browser block the response
    expect(fetchMock.mock.calls[0][1].credentials).not.toBe('include')
  })

  it('on 401, refreshes then retries the request', async () => {
    saveTokens('expired', 'ref-1')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: false, error: 'login required' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { access_token: 'acc-2', expires_in: 3600 } }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const resp = await apiFetch('/v1/sessions')

    expect(resp.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toContain('/api/auth/refresh')
    // the retried request must carry the NEW token, not the old one
    const retryHeaders = new Headers(fetchMock.mock.calls[2][1].headers)
    expect(retryHeaders.get('Authorization')).toBe('Bearer acc-2')
    expect(getAccessToken()).toBe('acc-2')
  })

  it('when refresh fails, clears tokens and reports auth lost', async () => {
    saveTokens('expired', 'bad-ref')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: false }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: false, error: 'invalid refresh token' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    const lost = vi.fn()
    onAuthLost(lost)

    const resp = await apiFetch('/v1/sessions')

    expect(resp.status).toBe(401)
    expect(getAccessToken()).toBeNull()
    expect(lost).toHaveBeenCalledOnce()
  })

  it('no refresh loop: gives up on a 401 after already refreshing', async () => {
    saveTokens('expired', 'ref-1')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: false }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { access_token: 'acc-2', expires_in: 3600 } }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: false }, 401))
    vi.stubGlobal('fetch', fetchMock)

    const resp = await apiFetch('/v1/sessions')

    expect(resp.status).toBe(401)
    // 3 calls: original request, refresh, retry. Must NOT refresh again.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('multiple requests hitting 401 refresh only ONCE', async () => {
    saveTokens('expired', 'ref-1')
    let refreshCalls = 0
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/auth/refresh')) {
        refreshCalls += 1
        return jsonResponse({ success: true, data: { access_token: 'acc-2', expires_in: 3600 } })
      }
      const auth = new Headers(init?.headers).get('Authorization')
      return auth === 'Bearer acc-2' ? jsonResponse({ ok: true }) : jsonResponse({}, 401)
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await Promise.all([apiFetch('/v1/a'), apiFetch('/v1/b'), apiFetch('/v1/c')])

    expect(refreshCalls).toBe(1)
    expect(results.every((r) => r.status === 200)).toBe(true)
  })

  it('multiple requests losing auth report onAuthLost only ONCE', async () => {
    saveTokens('expired', 'bad-ref')
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/auth/refresh')) return jsonResponse({ success: false }, 401)
      return jsonResponse({}, 401)
    })
    vi.stubGlobal('fetch', fetchMock)

    const lost = vi.fn()
    onAuthLost(lost)

    await Promise.all([apiFetch('/v1/a'), apiFetch('/v1/b'), apiFetch('/v1/c')])

    expect(lost).toHaveBeenCalledOnce()
  })

  it('a 5xx on refresh does NOT log the user out', async () => {
    saveTokens('expired', 'ref-1')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: false }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
    vi.stubGlobal('fetch', fetchMock)

    const lost = vi.fn()
    onAuthLost(lost)

    await apiFetch('/v1/sessions')

    // the API flickering is not a loss of access -- the token must stay intact
    expect(getAccessToken()).toBe('expired')
    expect(lost).not.toHaveBeenCalled()
  })
})
