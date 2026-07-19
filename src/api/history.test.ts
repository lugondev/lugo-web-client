import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteSession, getSession, listSessions } from './history'
import { saveTokens } from './tokens'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ROW = {
  id: 's1', profile_id: 'p', user_id: 'u1',
  created_at: '2026-07-17T10:00:00Z', ended_at: null, meta: {},
  message_count: 4, preview: 'Hello Lugo',
}

describe('history api', () => {
  beforeEach(() => {
    localStorage.clear()
    saveTokens('acc', 'ref')
    vi.restoreAllMocks()
  })

  it('listSessions returns an array of sessions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [ROW] })))
    const rows = await listSessions()
    expect(rows).toHaveLength(1)
    expect(rows[0].preview).toBe('Hello Lugo')
  })

  it('listSessions attaches bearer (i.e. goes through apiFetch)', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', f)
    await listSessions()
    expect(new Headers(f.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer acc')
  })

  it('listSessions passes limit and offset', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', f)
    await listSessions(50, 100)
    expect(String(f.mock.calls[0][0])).toContain('limit=50')
    expect(String(f.mock.calls[0][0])).toContain('offset=100')
  })

  it('getSession returns messages too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { ...ROW, messages: [{ turn: 1, role: 'user', content: 'hi' }] } }),
    ))
    const d = await getSession('s1')
    expect(d.messages).toHaveLength(1)
    expect(d.messages[0].role).toBe('user')
  })

  it('getSession 404 throws a friendly ENGLISH error, not the server string', async () => {
    // End users don't read raw technical errors. Last round we accidentally
    // showed "pairing code is invalid or expired" straight to their face.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: "Session 's1' not found" }, 404)))
    await expect(getSession('s1')).rejects.toThrow(/could not be found|deleted/i)
  })

  it('deleteSession uses the DELETE method', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { id: 's1', deleted: true } }))
    vi.stubGlobal('fetch', f)
    await deleteSession('s1')
    expect(String(f.mock.calls[0][0])).toContain('/v1/sessions/s1')
    expect(f.mock.calls[0][1].method).toBe('DELETE')
  })

  it('the id is encoded so it does not break the URL', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} }))
    vi.stubGlobal('fetch', f)
    await deleteSession('a/b c')
    expect(String(f.mock.calls[0][0])).toContain('a%2Fb%20c')
  })

  it('deleteSession throws when the server rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'nope' }, 404)))
    await expect(deleteSession('s1')).rejects.toThrow()
  })
})
