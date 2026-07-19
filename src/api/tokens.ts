// The ONLY place that touches token storage. Everything else goes through client.ts.
//
// Tokens live in localStorage so XSS can read them -- the accepted cost of
// choosing bearer over a BFF (see spec). A 1h access token TTL limits the damage.
const ACCESS_KEY = 'lugo.access_token'
const REFRESH_KEY = 'lugo.refresh_token'

export function saveTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}
