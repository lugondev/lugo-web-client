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

  it('gắn Authorization: Bearer từ token đã lưu', async () => {
    saveTokens('acc-1', 'ref-1')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/v1/sessions')

    const headers = new Headers(fetchMock.mock.calls[0][1].headers)
    expect(headers.get('Authorization')).toBe('Bearer acc-1')
  })

  it('KHÔNG bao giờ gửi cookie', async () => {
    saveTokens('acc-1', 'ref-1')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/v1/sessions')

    // backend tắt allow_credentials; gửi cookie chỉ khiến browser chặn response
    expect(fetchMock.mock.calls[0][1].credentials).not.toBe('include')
  })

  it('gặp 401 thì refresh rồi gọi lại request', async () => {
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
    // request gọi lại phải mang token MỚI, không phải token cũ
    const retryHeaders = new Headers(fetchMock.mock.calls[2][1].headers)
    expect(retryHeaders.get('Authorization')).toBe('Bearer acc-2')
    expect(getAccessToken()).toBe('acc-2')
  })

  it('refresh thất bại thì xoá token và báo auth lost', async () => {
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

  it('không refresh vòng lặp: 401 sau khi đã refresh thì bỏ cuộc', async () => {
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
    // 3 lần: request gốc, refresh, retry. KHÔNG được refresh lần nữa.
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('nhiều request cùng gặp 401 chỉ refresh MỘT lần', async () => {
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

  it('nhiều request cùng mất auth chỉ báo onAuthLost MỘT lần', async () => {
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

  it('refresh gặp 5xx thì KHÔNG đăng xuất người dùng', async () => {
    saveTokens('expired', 'ref-1')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: false }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
    vi.stubGlobal('fetch', fetchMock)

    const lost = vi.fn()
    onAuthLost(lost)

    await apiFetch('/v1/sessions')

    // API chớp nháy không phải là mất quyền -- token phải còn nguyên
    expect(getAccessToken()).toBe('expired')
    expect(lost).not.toHaveBeenCalled()
  })
})
