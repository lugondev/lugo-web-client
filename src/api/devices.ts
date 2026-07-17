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

/** Dịch lỗi của server sang tiếng Việt hành động được.
 *
 * Giữ SỰ PHÂN BIỆT của server (mã sai vs phần cứng đã ghép) vì hai tình huống
 * cần hai hành động khác nhau -- nhưng không giữ tiếng Anh: người dùng cuối
 * không phải lập trình viên. Lỗi lạ thì trả nguyên văn, thà khó hiểu còn hơn
 * mất thông tin.
 */
export function friendlyDeviceError(raw: string): string {
  if (/invalid or expired/i.test(raw)) {
    return 'Mã không đúng hoặc đã hết hạn. Mã chỉ dùng được trong 10 phút — bật lại thiết bị để lấy mã mới.'
  }
  if (/already paired/i.test(raw)) {
    return 'Thiết bị này đã ghép với một tài khoản rồi. Gỡ nó ở danh sách phía trên trước khi ghép lại.'
  }
  return raw
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
