import { apiFetch } from './client'

export type Device = {
  id: string
  user_id: string
  name: string
  serial: string
  created_at: string | null
  last_seen_at: string | null
  revoked: boolean
}

/** Lấy thông báo lỗi của server ra, giữ nguyên chữ.
 *
 * Server phân biệt "mã sai/hết hạn" với "phần cứng đã ghép rồi" -- hai tình
 * huống cần hai hành động khác nhau. Thay bằng một câu chung chung là lấy mất
 * của người dùng thứ họ cần để tự sửa.
 */
async function errorFrom(resp: Response): Promise<Error> {
  try {
    const body = await resp.json()
    const msg = body?.error ?? body?.detail
    if (typeof msg === 'string' && msg) return new Error(msg)
  } catch {
    // body không phải JSON -- rơi xuống thông báo mặc định
  }
  return new Error(`Máy chủ trả về lỗi ${resp.status}`)
}

export async function listDevices(): Promise<Device[]> {
  // /v1/devices/mine, KHÔNG phải /v1/devices -- cái sau là endpoint admin và
  // bearer sẽ nhận 403, đúng như thiết kế.
  const resp = await apiFetch('/v1/devices/mine')
  if (!resp.ok) throw await errorFrom(resp)
  const body = await resp.json()
  return body.data as Device[]
}

export async function claimDevice(code: string, name: string): Promise<Device> {
  const resp = await apiFetch('/v1/devices/pair/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, name }),
  })
  if (!resp.ok) throw await errorFrom(resp)
  const body = await resp.json()
  return body.data as Device
}

export async function revokeDevice(id: string): Promise<void> {
  const resp = await apiFetch(`/v1/devices/mine/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
  })
  if (!resp.ok) throw await errorFrom(resp)
}
