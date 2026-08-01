import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  claimDevice, friendlyDeviceError, listDevices, renameDevice, revokeDevice, setDeviceProfile,
} from './devices'
import { saveTokens } from './tokens'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const DEVICE = {
  id: 'd1', user_id: 'u1', name: 'Kitchen speaker', serial: 'ABC123', profile_id: '',
  created_at: '2026-07-17T10:00:00Z', last_seen_at: null, revoked: false,
}

describe('devices api', () => {
  beforeEach(() => {
    localStorage.clear()
    saveTokens('acc', 'ref')
    vi.restoreAllMocks()
  })

  it('listDevices returns an array of devices', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [DEVICE] })))
    const list = await listDevices()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Kitchen speaker')
  })

  it('listDevices calls MY endpoint, not the admin endpoint', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', f)
    await listDevices()
    // /v1/devices is the admin endpoint -- the bearer will 403, and rightly so.
    expect(f.mock.calls[0][0]).toContain('/v1/devices/mine')
  })

  it('listDevices attaches bearer (i.e. goes through apiFetch, not raw fetch)', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', f)
    await listDevices()
    expect(new Headers(f.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer acc')
  })

  it('claimDevice sends code and name, unassigned by default', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: DEVICE }))
    vi.stubGlobal('fetch', f)
    const d = await claimDevice('123456', 'Kitchen speaker')
    expect(f.mock.calls[0][0]).toContain('/v1/devices/pair/claim')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
      code: '123456', name: 'Kitchen speaker', profile_id: '',
    })
    expect(d.id).toBe('d1')
  })

  it('claimDevice binds the assistant in the same call', async () => {
    // One request, not claim-then-assign: a failed second call would leave the
    // device paired but answering to nothing.
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: DEVICE }))
    vi.stubGlobal('fetch', f)
    await claimDevice('123456', 'Kitchen speaker', 'kitchen')
    expect(JSON.parse(f.mock.calls[0][1].body).profile_id).toBe('kitchen')
  })

  it('setDeviceProfile posts to the own-device subresource', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal('fetch', f)
    await setDeviceProfile('d1', 'study')
    expect(f.mock.calls[0][0]).toContain('/v1/devices/mine/d1/profile')
    expect(f.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ profile_id: 'study' })
  })

  it('setDeviceProfile sends an empty name to unassign', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal('fetch', f)
    await setDeviceProfile('d1', '')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ profile_id: '' })
  })

  it('setDeviceProfile surfaces the server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ success: false, detail: "profile 'gone' not found" }, 404),
    ))
    await expect(setDeviceProfile('d1', 'gone')).rejects.toThrow(/not found/)
  })

  it('claimDevice keeps the server error message verbatim', async () => {
    // The server distinguishes "wrong code" from "hardware already paired" --
    // those two errors need two different fixes. Swallowing that info hurts the user.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ success: false, error: 'pairing code is invalid or expired' }, 400),
    ))
    await expect(claimDevice('000000', 'X')).rejects.toThrow(/invalid or expired/)
  })

  it("revokeDevice calls the user's own path", async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true }))
    vi.stubGlobal('fetch', f)
    await revokeDevice('d1')
    expect(f.mock.calls[0][0]).toContain('/v1/devices/mine/d1/revoke')
    expect(f.mock.calls[0][1].method).toBe('POST')
  })

  it('revokeDevice throws when the server rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'not found' }, 404)))
    await expect(revokeDevice('nope')).rejects.toThrow()
  })

  it('renameDevice posts the new name to MY device, url-encoding the id', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { id: 'a/b', name: 'Kitchen' } }))
    vi.stubGlobal('fetch', f)

    await renameDevice('a/b', 'Kitchen')

    expect(f.mock.calls[0][0]).toContain('/v1/devices/mine/a%2Fb/name')
    expect(f.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ name: 'Kitchen' })
  })

  it('renameDevice surfaces the server message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: "device 'x' not found" }, 404)))

    await expect(renameDevice('x', 'Kitchen')).rejects.toThrow(/not found/)
  })

  it('claimDevice sends an empty name, letting the server name the device', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: DEVICE }))
    vi.stubGlobal('fetch', f)

    await claimDevice('01234567')

    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
      code: '01234567',
      name: '',
      profile_id: '',
    })
  })
})

describe('friendlyDeviceError', () => {
  it('translates "invalid or expired" into an actionable English message', () => {
    const msg = friendlyDeviceError('pairing code is invalid or expired')
    expect(msg).toContain('wrong or expired')
  })

  it('translates "already paired" into an actionable English message', () => {
    const msg = friendlyDeviceError('device already paired to another account')
    expect(msg).toContain('already paired to an account')
  })

  it('returns unknown errors verbatim -- must not swallow information', () => {
    const raw = 'internal server error: db timeout'
    expect(friendlyDeviceError(raw)).toBe(raw)
  })
})
