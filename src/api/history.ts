import { apiFetch } from './client'

export type Message = { turn: number; role: string; content: string }

export type SessionRow = {
  id: string
  profile_id: string
  user_id: string | null
  created_at: string | null
  ended_at: string | null
  meta: Record<string, unknown>
  message_count: number
  preview: string
}

export type SessionDetail = SessionRow & { messages: Message[] }

/** Lỗi tiếng Việt cho người dùng cuối.
 *
 * Server trả 404 cho CẢ "không tồn tại" LẪN "không phải của bạn" -- nó cố ý
 * không phân biệt. Nên copy ở đây không được khẳng định phiên "đã bị xoá":
 * ta không biết điều đó.
 */
async function errorFrom(resp: Response): Promise<Error> {
  if (resp.status === 404) {
    return new Error('This conversation could not be found. It may have been deleted.')
  }
  if (resp.status === 401 || resp.status === 403) {
    return new Error('Your session has expired. Please sign in again.')
  }
  return new Error(`Server returned error ${resp.status}`)
}

export async function listSessions(limit = 20, offset = 0): Promise<SessionRow[]> {
  const resp = await apiFetch(`/v1/sessions?limit=${limit}&offset=${offset}`)
  if (!resp.ok) throw await errorFrom(resp)
  const body = await resp.json()
  return body.data as SessionRow[]
}

export async function getSession(id: string): Promise<SessionDetail> {
  const resp = await apiFetch(`/v1/sessions/${encodeURIComponent(id)}`)
  if (!resp.ok) throw await errorFrom(resp)
  const body = await resp.json()
  return body.data as SessionDetail
}

export async function deleteSession(id: string): Promise<void> {
  const resp = await apiFetch(`/v1/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!resp.ok) throw await errorFrom(resp)
}
