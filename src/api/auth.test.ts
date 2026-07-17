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

  it('login lưu cả hai token', async () => {
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

  it('login gọi /api/auth/token, KHÔNG gọi /api/auth/login', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { access_token: 'a', refresh_token: 'r', expires_in: 3600 } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await login('toan', 'pw12345678')

    // /api/auth/login là lối cookie của admin webui -- client này không dùng
    expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/token')
  })

  it('sai mật khẩu thì ném lỗi và không lưu token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ success: false, error: 'invalid username or password' }, 401)),
    )

    await expect(login('toan', 'sai')).rejects.toThrow()
    expect(getAccessToken()).toBeNull()
  })

  it('200 nhưng thiếu token thì KHÔNG lưu gì và báo lỗi', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} })))

    await expect(login('toan', 'pw12345678')).rejects.toThrow()
    // localStorage ép undefined thành chuỗi "undefined" -- phải chặn từ đầu
    expect(getAccessToken()).toBeNull()
    expect(isAuthed()).toBe(false)
  })

  it('200 nhưng thiếu hẳn data thì báo lỗi tử tế, không ném TypeError thô', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true })))

    await expect(login('toan', 'pw12345678')).rejects.toThrow(/không hợp lệ/)
    expect(isAuthed()).toBe(false)
  })

  it('logout xoá token', async () => {
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
