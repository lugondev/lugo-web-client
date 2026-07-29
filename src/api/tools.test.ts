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

  it('turns the audio response into an object URL', async () => {
    const blob = new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], { type: 'audio/wav' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(blob, {
      status: 200, headers: { 'Content-Type': 'audio/wav' },
    })))
    const createObjectURL = vi.fn().mockReturnValue('blob:fake')
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })

    const r = await synthesize('xin chao')

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(r.audioUrl).toBe('blob:fake')
  })

  it('synthesize on error throws a friendly English message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: false, error: 'engine not found' }, 400)))
    await expect(synthesize('x')).rejects.toThrow(/could not|try/i)
  })
})
