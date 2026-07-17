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

  it('transcribeFile trả text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { engine: 'x', text: 'xin chào', is_final: true } }),
    ))
    expect(await transcribeFile(new File(['x'], 'a.wav'))).toBe('xin chào')
  })

  it('transcribeFile gửi multipart với field tên "audio"', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { text: 'ok' } }))
    vi.stubGlobal('fetch', f)
    await transcribeFile(new File(['x'], 'a.wav'))
    expect(String(f.mock.calls[0][0])).toContain('/v1/stt/transcribe')
    const body = f.mock.calls[0][1].body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('audio')).toBeInstanceOf(File)
  })

  it('transcribeFile KHÔNG tự đặt Content-Type', async () => {
    // Trình duyệt phải tự sinh boundary cho multipart. Tự đặt Content-Type
    // là làm hỏng boundary và server sẽ không parse được.
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { text: 'ok' } }))
    vi.stubGlobal('fetch', f)
    await transcribeFile(new File(['x'], 'a.wav'))
    const h = new Headers(f.mock.calls[0][1].headers)
    expect(h.get('Content-Type')).toBeNull()
  })

  it('transcribeFile gắn bearer (đi qua apiFetch)', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { text: 'ok' } }))
    vi.stubGlobal('fetch', f)
    await transcribeFile(new File(['x'], 'a.wav'))
    expect(new Headers(f.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer acc')
  })

  it('transcribeFile lỗi thì ném tiếng Việt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'STT failed (vosk): boom' }, 500)))
    await expect(transcribeFile(new File(['x'], 'a.wav'))).rejects.toThrow(/không|thất bại/i)
  })

  it('synthesize gửi CHỈ text', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({
      success: true, data: { engine: 'e', sample_rate: 24000, audio_url: '/artifacts/a.wav', duration_seconds: 1.5 },
    }))
    vi.stubGlobal('fetch', f)
    const r = await synthesize('xin chào')
    expect(String(f.mock.calls[0][0])).toContain('/v1/tts/synthesize')
    // Không gửi engine/voice: chọn engine là việc của quản trị, không phải
    // của người dùng cuối.
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ text: 'xin chào' })
    expect(r.audioUrl).toContain('/artifacts/a.wav')
    expect(r.durationSeconds).toBe(1.5)
  })

  it('synthesize trả URL tuyệt đối để thẻ audio dùng được', async () => {
    // audio_url của server là đường dẫn tương đối. Client chạy ở domain KHÁC,
    // nên để nguyên sẽ trỏ vào chính domain của client -> 404.
    const f = vi.fn().mockResolvedValue(jsonResponse({
      success: true, data: { audio_url: '/artifacts/a.wav', duration_seconds: null },
    }))
    vi.stubGlobal('fetch', f)
    const r = await synthesize('x')
    expect(r.audioUrl.startsWith('http')).toBe(true)
  })

  it('synthesize lỗi thì ném tiếng Việt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: false, error: 'engine not found' }, 400)))
    await expect(synthesize('x')).rejects.toThrow(/không|thất bại/i)
  })
})
