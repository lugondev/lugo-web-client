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

/** Pull the server's error message out, keeping its wording verbatim.
 *
 * The server distinguishes "wrong/expired code" from "hardware already paired"
 * -- two situations that need two different actions. Replacing them with one
 * generic sentence robs the user of what they need to fix it themselves.
 */
async function errorFrom(resp: Response): Promise<Error> {
  try {
    const body = await resp.json()
    const msg = body?.error ?? body?.detail
    if (typeof msg === 'string' && msg) return new Error(msg)
  } catch {
    // body isn't JSON -- fall through to the default message
  }
  return new Error(`Server returned error ${resp.status}`)
}

/** Translate the server's error into an actionable message.
 *
 * Keep the server's DISTINCTION (wrong code vs hardware already paired) because
 * the two situations need two different actions -- but drop the raw wording: the
 * end user is not a programmer. For unknown errors, return them verbatim; better
 * hard to read than information lost.
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
  // /v1/devices/mine, NOT /v1/devices -- the latter is the admin endpoint and
  // the bearer will get a 403, exactly as designed.
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
