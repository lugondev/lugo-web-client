import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export function ApiUrl(path: string): string {
  return `${BASE_URL}${path}`
}

let authLostCb: (() => void) | null = null

export function onAuthLost(cb: () => void): void {
  authLostCb = cb
}

// Refresh gặp lỗi KHÔNG quyết định (5xx, lỗi mạng) khác với refresh bị từ
// chối dứt khoát (401): cái sau nghĩa là mất auth thật, cái trước chỉ là API
// chớp nháy -- không được đăng xuất người dùng vì một lần backend lag.
class TransientRefreshError extends Error {}

// Một refresh đang bay thì mọi request 401 khác cùng chờ nó, thay vì mỗi
// request tự refresh -- ba request song song hết hạn cùng lúc không được biến
// thành ba lần refresh.
let refreshInFlight: Promise<string | null> | null = null

// Chốt để mỗi CHU KỲ refresh (một refreshInFlight) chỉ báo onAuthLost tối đa
// một lần, dù bao nhiêu request đang chờ chung chu kỳ đó cùng phát hiện mất
// auth. Chốt được reset mỗi khi một chu kỳ refresh MỚI bắt đầu (xem
// sharedRefresh) nên một lần mất auth thật sự sau này (chu kỳ mới) vẫn báo
// lại bình thường -- "tối đa một lần" chỉ tính trong phạm vi một chu kỳ, không
// phải suốt đời process.
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
    // Lỗi mạng khi gọi refresh không phải là bằng chứng token hỏng.
    throw new TransientRefreshError('network error calling /api/auth/refresh')
  }

  // 401 là tín hiệu DỨT KHOÁT từ backend: refresh token sai hoặc user bị
  // khoá -- đây là trường hợp duy nhất nghĩa là mất auth thật.
  if (resp.status === 401) return null
  if (!resp.ok) {
    // 5xx / lỗi tạm thời khác: KHÔNG phải mất auth, đừng đăng xuất người dùng.
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
  // Không set credentials: backend tắt allow_credentials, và client này không
  // dùng cookie -- auth chỉ một phương thức, không fallback.
  return { ...init, headers }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const resp = await fetch(ApiUrl(path), withAuth(init, getAccessToken()))
  if (resp.status !== 401) return resp

  // 401 ở đây luôn nghĩa là token không dùng được: backend không fallback sang
  // danh tính khác, nên đây là tín hiệu refresh rõ ràng.
  let access: string | null
  try {
    access = await sharedRefresh()
  } catch (err) {
    if (err instanceof TransientRefreshError) {
      // API chớp nháy khi refresh không phải là mất quyền -- giữ nguyên
      // token, trả lại response 401 gốc để caller tự quyết (vd. thử lại sau).
      return resp
    }
    throw err
  }
  if (!access) {
    notifyAuthLost()
    return resp
  }

  // Gọi lại đúng MỘT lần. 401 tiếp nghĩa là hết cách -- không lặp vô hạn.
  const retry = await fetch(ApiUrl(path), withAuth(init, access))
  if (retry.status === 401) {
    notifyAuthLost()
  }
  return retry
}
