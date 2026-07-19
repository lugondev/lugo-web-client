import { ApiUrl } from './client'
import { clearTokens, getAccessToken, saveTokens } from './tokens'

export async function login(username: string, password: string): Promise<void> {
  // /api/auth/token, NOT /api/auth/login -- the latter is the admin webui's
  // cookie flow and is deliberately kept separate from this client.
  const resp = await fetch(ApiUrl('/api/auth/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!resp.ok) {
    throw new Error('Wrong username or password')
  }
  const body = await resp.json()
  const { access_token, refresh_token } = body.data ?? {}
  // 200 doesn't mean the data is valid: if a token is missing, destructuring
  // yields undefined, and localStorage.setItem coerces undefined into the string
  // "undefined" -- getAccessToken() would be non-null and isAuthed() true with a
  // garbage token. This isn't a wrong password (don't say that), it's a broken server.
  if (typeof access_token !== 'string' || access_token === '' || typeof refresh_token !== 'string' || refresh_token === '') {
    throw new Error('The server returned invalid data')
  }
  saveTokens(access_token, refresh_token)
}

export function logout(): void {
  clearTokens()
}

export function isAuthed(): boolean {
  return getAccessToken() !== null
}
