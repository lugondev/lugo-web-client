import { ApiUrl } from './client'
import { clearTokens, getAccessToken, saveTokens } from './tokens'

export async function login(username: string, password: string): Promise<void> {
  // /api/auth/token, KHÔNG phải /api/auth/login -- cái sau là lối cookie của
  // admin webui và cố ý tách biệt khỏi client này.
  const resp = await fetch(ApiUrl('/api/auth/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!resp.ok) {
    throw new Error('Sai tên đăng nhập hoặc mật khẩu')
  }
  const body = await resp.json()
  const { access_token, refresh_token } = body.data
  saveTokens(access_token, refresh_token)
}

export function logout(): void {
  clearTokens()
}

export function isAuthed(): boolean {
  return getAccessToken() !== null
}
