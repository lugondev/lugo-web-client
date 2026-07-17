// Nơi DUY NHẤT chạm vào storage của token. Mọi thứ khác đi qua client.ts.
//
// Token nằm trong localStorage nên XSS đọc được -- đây là cái giá đã chấp nhận
// khi chọn bearer thay vì BFF (xem spec). Access token TTL 1h giới hạn thiệt hại.
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
