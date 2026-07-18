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
  return new Error(`Server returned error ${resp.status}`)
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
    return 'That code is wrong or expired. Codes last 10 minutes — restart the device to get a new one.'
  }
  if (/already paired/i.test(raw)) {
    return 'This device is already paired to an account. Remove it from the list above before pairing again.'
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
