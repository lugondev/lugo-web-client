import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export function ApiUrl(path: string): string {
  return `${BASE_URL}${path}`
}

let authLostCb: (() => void) | null = null

export function onAuthLost(cb: () => void): void {
  authLostCb = cb
}

// Một refresh đang bay thì mọi request 401 khác cùng chờ nó, thay vì mỗi
// request tự refresh -- ba request song song hết hạn cùng lúc không được biến
// thành ba lần refresh.
let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null

  const resp = await fetch(ApiUrl('/api/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  })
  if (!resp.ok) return null

  const body = await resp.json()
  const access = body?.data?.access_token
  if (!access) return null

  saveTokens(access, refresh)
  return access
}

function sharedRefresh(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

function withAuth(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  // Không set credentials: backend tắt allow_credentials, và client này không
  // dùng cookie -- auth chỉ một phương thức, không fallback.
  return { ...init, headers }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const resp = await fetch(ApiUrl(path), withAuth(init, getAccessToken()))
  if (resp.status !== 401) return resp

  // 401 ở đây luôn nghĩa là token không dùng được: backend không fallback sang
  // danh tính khác, nên đây là tín hiệu refresh rõ ràng.
  const access = await sharedRefresh()
  if (!access) {
    clearTokens()
    authLostCb?.()
    return resp
  }

  // Gọi lại đúng MỘT lần. 401 tiếp nghĩa là hết cách -- không lặp vô hạn.
  const retry = await fetch(ApiUrl(path), withAuth(init, access))
  if (retry.status === 401) {
    clearTokens()
    authLostCb?.()
  }
  return retry
}
