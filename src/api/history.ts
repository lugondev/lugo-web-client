import { apiFetch } from './client'

// created_at is optional: rows the server wrote before it started sending
// per-message times still parse, they just have no time to show.
export type Message = { turn: number; role: string; content: string; created_at?: string | null }

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

/** User-facing error messages.
 *
 * The server returns 404 for BOTH "doesn't exist" AND "not yours" -- it
 * deliberately doesn't distinguish them. So the copy here must not assert the
 * session "was deleted": we don't actually know that.
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

/** Recent sessions, newest first.
 *
 * `profile` filters server-side (`sessions.profile_id`) rather than in the
 * browser: history is now read per assistant, and filtering a fixed page here
 * would silently show fewer than `limit` rows -- or none at all for an assistant
 * whose conversations fell off the page. */
export async function listSessions(
  limit = 20,
  offset = 0,
  profile?: string,
): Promise<SessionRow[]> {
  const scope = profile ? `&profile=${encodeURIComponent(profile)}` : ''
  const resp = await apiFetch(`/v1/sessions?limit=${limit}&offset=${offset}${scope}`)
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
