import { beforeEach, describe, expect, it, vi } from 'vitest'
import { synthesize, transcribeFile } from './tools'
import { saveTokens } from './tokens'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('tools api', () => {
  beforeEach(() => {
    localStorage.clear()
    saveTokens('acc', 'ref')
    vi.restoreAllMocks()
  })

  it('transcribeFile returns text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { engine: 'x', text: 'hello', is_final: true } }),
    ))
    expect(await transcribeFile(new File(['x'], 'a.wav'))).toBe('hello')
  })

  it('transcribeFile sends multipart with a field named "audio"', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { text: 'ok' } }))
    vi.stubGlobal('fetch', f)
    await transcribeFile(new File(['x'], 'a.wav'))
    expect(String(f.mock.calls[0][0])).toContain('/v1/stt/transcribe')
    const body = f.mock.calls[0][1].body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('audio')).toBeInstanceOf(File)
  })

  it('transcribeFile does NOT set Content-Type itself', async () => {
    // The browser must generate the multipart boundary itself. Setting
    // Content-Type manually breaks the boundary and the server can't parse it.
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { text: 'ok' } }))
    vi.stubGlobal('fetch', f)
    await transcribeFile(new File(['x'], 'a.wav'))
    const h = new Headers(f.mock.calls[0][1].headers)
    expect(h.get('Content-Type')).toBeNull()
  })

  it('transcribeFile attaches bearer (goes through apiFetch)', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { text: 'ok' } }))
    vi.stubGlobal('fetch', f)
    await transcribeFile(new File(['x'], 'a.wav'))
    expect(new Headers(f.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer acc')
  })

  it('transcribeFile on error throws a friendly English message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'STT failed (vosk): boom' }, 500)))
    await expect(transcribeFile(new File(['x'], 'a.wav'))).rejects.toThrow(/could not|try/i)
  })

  it('synthesize sends ONLY text', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({
      success: true, data: { engine: 'e', sample_rate: 24000, audio_url: '/artifacts/a.wav', duration_seconds: 1.5 },
    }))
    vi.stubGlobal('fetch', f)
    const r = await synthesize('hello')
    expect(String(f.mock.calls[0][0])).toContain('/v1/tts/synthesize')
    // Don't send engine/voice: choosing the engine is an admin job, not the
    // end user's.
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ text: 'hello' })
    expect(r.audioUrl).toContain('/artifacts/a.wav')
    expect(r.durationSeconds).toBe(1.5)
  })

  it('synthesize returns an absolute URL so the audio tag works', async () => {
    // The server's audio_url is a relative path. The client runs on a DIFFERENT
    // domain, so leaving it as-is would point at the client's own domain -> 404.
    const f = vi.fn().mockResolvedValue(jsonResponse({
      success: true, data: { audio_url: '/artifacts/a.wav', duration_seconds: null },
    }))
    vi.stubGlobal('fetch', f)
    const r = await synthesize('x')
    expect(r.audioUrl.startsWith('http')).toBe(true)
  })

  it('synthesize on error throws a friendly English message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: false, error: 'engine not found' }, 400)))
    await expect(synthesize('x')).rejects.toThrow(/could not|try/i)
  })
})
