import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isAuthed, login, logout } from './auth'
import { getAccessToken, getRefreshToken } from './tokens'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('auth', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('login saves both tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: { access_token: 'acc', refresh_token: 'ref', expires_in: 3600 },
        }),
      ),
    )

    await login('toan', 'pw12345678')

    expect(getAccessToken()).toBe('acc')
    expect(getRefreshToken()).toBe('ref')
    expect(isAuthed()).toBe(true)
  })

  it('login calls /api/auth/token, NOT /api/auth/login', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { access_token: 'a', refresh_token: 'r', expires_in: 3600 } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await login('toan', 'pw12345678')

    // /api/auth/login is the admin webui's cookie flow -- this client doesn't use it
    expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/token')
  })

  it('wrong password throws and saves no token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ success: false, error: 'invalid username or password' }, 401)),
    )

    await expect(login('toan', 'sai')).rejects.toThrow()
    expect(getAccessToken()).toBeNull()
  })

  it('200 but missing token saves NOTHING and reports an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} })))

    await expect(login('toan', 'pw12345678')).rejects.toThrow()
    // localStorage coerces undefined into the string "undefined" -- must block it upfront
    expect(getAccessToken()).toBeNull()
    expect(isAuthed()).toBe(false)
  })

  it('200 but data missing entirely reports a clean error, not a raw TypeError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true })))

    await expect(login('toan', 'pw12345678')).rejects.toThrow(/invalid data/i)
    expect(isAuthed()).toBe(false)
  })

  it('logout clears the tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ success: true, data: { access_token: 'a', refresh_token: 'r', expires_in: 3600 } }),
      ),
    )
    await login('toan', 'pw12345678')
    logout()
    expect(isAuthed()).toBe(false)
  })
})
