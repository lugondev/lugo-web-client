import { ApiUrl, apiFetch } from './client'

async function viError(resp: Response, fallback: string): Promise<Error> {
  if (resp.status === 401 || resp.status === 403) {
    return new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.')
  }
  return new Error(fallback)
}

export async function transcribeFile(file: File): Promise<string> {
  const body = new FormData()
  body.append('audio', file)
  // Chỉ gửi file. engine/language/denoise/vad đều optional -> server dùng mặc
  // định của nó. Chọn engine là việc của quản trị, không phải người dùng cuối.
  //
  // KHÔNG đặt Content-Type: trình duyệt phải tự sinh boundary cho multipart.
  const resp = await apiFetch('/v1/stt/transcribe', { method: 'POST', body })
  if (!resp.ok) {
    throw await viError(resp, 'Không nhận dạng được file này. Thử file wav hoặc mp3 khác xem sao.')
  }
  const json = await resp.json()
  return (json.data?.text ?? '') as string
}

export async function synthesize(text: string): Promise<{
  audioUrl: string
  durationSeconds: number | null
}> {
  const resp = await apiFetch('/v1/tts/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!resp.ok) {
    throw await viError(resp, 'Không đọc được đoạn này. Thử lại sau ít phút.')
  }
  const json = await resp.json()
  const url = json.data?.audio_url as string | undefined
  if (!url) throw new Error('Máy chủ không trả về audio.')
  return {
    // audio_url là đường dẫn tương đối của API. Client chạy domain KHÁC, nên
    // phải ghép base URL vào, không thì thẻ <audio> trỏ vào domain client -> 404.
    audioUrl: url.startsWith('http') ? url : ApiUrl(url),
    durationSeconds: (json.data?.duration_seconds ?? null) as number | null,
  }
}
