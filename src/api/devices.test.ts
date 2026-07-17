import { beforeEach, describe, expect, it, vi } from 'vitest'
import { claimDevice, friendlyDeviceError, listDevices, revokeDevice } from './devices'
import { saveTokens } from './tokens'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const DEVICE = {
  id: 'd1', user_id: 'u1', name: 'Loa bếp', serial: 'ABC123',
  created_at: '2026-07-17T10:00:00Z', last_seen_at: null, revoked: false,
}

describe('devices api', () => {
  beforeEach(() => {
    localStorage.clear()
    saveTokens('acc', 'ref')
    vi.restoreAllMocks()
  })

  it('listDevices trả mảng device', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [DEVICE] })))
    const list = await listDevices()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Loa bếp')
  })

  it('listDevices gọi đúng endpoint CỦA TÔI, không phải endpoint admin', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', f)
    await listDevices()
    // /v1/devices là endpoint admin -- bearer sẽ 403 và đúng ra phải thế.
    expect(f.mock.calls[0][0]).toContain('/v1/devices/mine')
  })

  it('listDevices gắn bearer (tức đi qua apiFetch, không tự fetch)', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', f)
    await listDevices()
    expect(new Headers(f.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer acc')
  })

  it('claimDevice gửi code và name', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: DEVICE }))
    vi.stubGlobal('fetch', f)
    const d = await claimDevice('123456', 'Loa bếp')
    expect(f.mock.calls[0][0]).toContain('/v1/devices/pair/claim')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ code: '123456', name: 'Loa bếp' })
    expect(d.id).toBe('d1')
  })

  it('claimDevice giữ nguyên thông báo lỗi của server', async () => {
    // Server phân biệt "mã sai" với "phần cứng đã ghép rồi" -- hai lỗi đó cần
    // hai cách xử lý khác nhau. Nuốt mất thông tin đó là hại người dùng.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ success: false, error: 'pairing code is invalid or expired' }, 400),
    ))
    await expect(claimDevice('000000', 'X')).rejects.toThrow(/invalid or expired/)
  })

  it('revokeDevice gọi đúng đường của user', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal('fetch', f)
    await revokeDevice('d1')
    expect(f.mock.calls[0][0]).toContain('/v1/devices/mine/d1/revoke')
    expect(f.mock.calls[0][1].method).toBe('POST')
  })

  it('revokeDevice ném lỗi khi server từ chối', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'not found' }, 404)))
    await expect(revokeDevice('nope')).rejects.toThrow()
  })
})

describe('friendlyDeviceError', () => {
  it('dịch "invalid or expired" sang tiếng Việt hành động được', () => {
    const msg = friendlyDeviceError('pairing code is invalid or expired')
    expect(msg).not.toMatch(/invalid|expired/i)
    expect(msg).toContain('Mã không đúng hoặc đã hết hạn')
  })

  it('dịch "already paired" sang tiếng Việt hành động được', () => {
    const msg = friendlyDeviceError('device already paired to another account')
    expect(msg).not.toMatch(/already paired/i)
    expect(msg).toContain('đã ghép với một tài khoản rồi')
  })

  it('lỗi lạ thì trả nguyên văn -- không được nuốt mất thông tin', () => {
    const raw = 'internal server error: db timeout'
    expect(friendlyDeviceError(raw)).toBe(raw)
  })
})
