import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export function ApiUrl(path: string): string {
  return `${BASE_URL}${path}`
}

let authLostCb: (() => void) | null = null

export function onAuthLost(cb: () => void): void {
  authLostCb = cb
}

// An INDECISIVE refresh failure (5xx, network error) is different from a
// DEFINITIVE rejection (401): the latter means auth is truly lost, the former
// is just the API flickering -- don't log the user out over one backend hiccup.
class TransientRefreshError extends Error {}

// While a refresh is in flight, every other 401 request waits on it instead of
// refreshing on its own -- three parallel requests expiring at the same moment
// must not turn into three refreshes.
let refreshInFlight: Promise<string | null> | null = null

// Latch so each refresh CYCLE (one refreshInFlight) fires onAuthLost at most
// once, no matter how many requests waiting on that cycle detect the lost auth.
// The latch resets whenever a NEW refresh cycle begins (see sharedRefresh), so a
// genuine later loss of auth (new cycle) still reports normally -- "at most once"
// is scoped to a single cycle, not the lifetime of the process.
let authLostNotifiedThisCycle = false

function notifyAuthLost(): void {
  if (authLostNotifiedThisCycle) return
  authLostNotifiedThisCycle = true
  clearTokens()
  authLostCb?.()
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null

  let resp: Response
  try {
    resp = await fetch(ApiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
  } catch {
    // A network error calling refresh is no proof the token is bad.
    throw new TransientRefreshError('network error calling /api/auth/refresh')
  }

  // 401 is the DEFINITIVE signal from the backend: refresh token is wrong or the
  // user is locked out -- the only case that means auth is truly lost.
  if (resp.status === 401) return null
  if (!resp.ok) {
    // 5xx / other transient errors: NOT lost auth, don't log the user out.
    throw new TransientRefreshError(`refresh failed with status ${resp.status}`)
  }

  const body = await resp.json()
  const access = body?.data?.access_token
  if (!access) return null

  saveTokens(access, refresh)
  return access
}

function sharedRefresh(): Promise<string | null> {
  if (!refreshInFlight) {
    authLostNotifiedThisCycle = false
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

function withAuth(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  // Don't set credentials: the backend disables allow_credentials, and this
  // client uses no cookies -- auth is single-method, with no fallback.
  return { ...init, headers }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const resp = await fetch(ApiUrl(path), withAuth(init, getAccessToken()))
  if (resp.status !== 401) return resp

  // A 401 here always means the token is unusable: the backend doesn't fall back
  // to another identity, so this is an unambiguous refresh signal.
  let access: string | null
  try {
    access = await sharedRefresh()
  } catch (err) {
    if (err instanceof TransientRefreshError) {
      // The API flickering during refresh is not a loss of access -- keep the
      // token, return the original 401 so the caller can decide (e.g. retry later).
      return resp
    }
    throw err
  }
  if (!access) {
    notifyAuthLost()
    return resp
  }

  // Retry exactly ONCE. Another 401 means we're out of options -- no infinite loop.
  const retry = await fetch(ApiUrl(path), withAuth(init, access))
  if (retry.status === 401) {
    notifyAuthLost()
  }
  return retry
}
