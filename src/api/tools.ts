import { apiFetch } from './client'

async function viError(resp: Response, fallback: string): Promise<Error> {
  if (resp.status === 401 || resp.status === 403) {
    return new Error('Your session has expired. Please sign in again.')
  }
  return new Error(fallback)
}

export async function transcribeFile(file: File): Promise<string> {
  const body = new FormData()
  body.append('audio', file)
  // Only send the file. engine/language/denoise/vad are all optional -> the
  // server uses its own defaults. Choosing the engine is an admin job, not the
  // end user's.
  //
  // Do NOT set Content-Type: the browser must generate the multipart boundary itself.
  const resp = await apiFetch('/v1/stt/transcribe', { method: 'POST', body })
  if (!resp.ok) {
    throw await viError(resp, 'Could not transcribe this file. Try a different wav or mp3.')
  }
  const json = await resp.json()
  return (json.data?.text ?? '') as string
}

export async function synthesize(text: string): Promise<{ audioUrl: string }> {
  const resp = await apiFetch('/v1/tts/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!resp.ok) {
    throw await viError(resp, 'Could not read this out. Try again in a moment.')
  }
  // The endpoint returns raw audio bytes, not JSON: an object URL keeps the
  // audio in this tab's memory and never round-trips through the server.
  return { audioUrl: URL.createObjectURL(await resp.blob()) }
}
