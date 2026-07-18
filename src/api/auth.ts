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
    throw new Error('Wrong username or password')
  }
  const body = await resp.json()
  const { access_token, refresh_token } = body.data ?? {}
  // 200 không đồng nghĩa dữ liệu hợp lệ: nếu thiếu token, destructure ra
  // undefined, và localStorage.setItem ép undefined thành chuỗi "undefined"
  // -- getAccessToken() sẽ khác null, isAuthed() thành true với token rác.
  // Đây không phải sai mật khẩu (không được nói vậy), mà là máy chủ hỏng.
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
