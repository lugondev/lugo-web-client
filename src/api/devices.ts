import { apiFetch } from './client'

export type Device = {
  id: string
  user_id: string
  name: string
  serial: string
  /** Name of the assistant this device runs; '' means unassigned.
   *
   * The server is the source of truth here -- a paired device's own config is
   * ignored when this is set. Unassigned is a legal, normal state, not an error:
   * the device keeps its pairing when its assistant is deleted. */
  profile_id: string
  created_at: string | null
  last_seen_at: string | null
  revoked: boolean
}

/** Length of the pairing code the device shows on its screen.
 *
 * One place, because this was three hardcoded 6s when the server widened its
 * code to 8 digits (api_gateway app/services/auth/pairing.py, `_CODE_DIGITS`) --
 * the input refused the last two characters and the submit button stayed
 * disabled, which made pairing impossible from the web client entirely. */
export const PAIR_CODE_LENGTH = 8

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

/** Pair a device and, when `profileId` is given, bind it in the same call.
 *
 * One request rather than claim-then-assign: pairing always starts from inside an
 * assistant in this UI, so the answer is already known, and a two-step version
 * would leave a device paired-but-unassigned whenever the second call failed. */
export async function claimDevice(
  code: string,
  name = '',
  profileId = '',
): Promise<Device> {
  const resp = await apiFetch('/v1/devices/pair/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, name, profile_id: profileId }),
  })
  if (!resp.ok) throw await errorFrom(resp)
  const body = await resp.json()
  return body.data as Device
}

/** Move a device to another assistant, or unassign it with `profileId = ''`.
 *
 * Never touches the pairing token: switching assistants must not send the user
 * back to the hardware to read a fresh code off its screen. */
export async function setDeviceProfile(id: string, profileId: string): Promise<void> {
  const resp = await apiFetch(`/v1/devices/mine/${encodeURIComponent(id)}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_id: profileId }),
  })
  if (!resp.ok) throw await errorFrom(resp)
}

export async function revokeDevice(id: string): Promise<void> {
  const resp = await apiFetch(`/v1/devices/mine/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
  })
  if (!resp.ok) throw await errorFrom(resp)
}

/** Rename a device. Never touches the pairing token or the assistant binding.
 *
 * A device arrives named after its own setup AP (Lugo-XXXX, chosen by the
 * server from the pairing serial), so this is always an edit of something that
 * already reads sensibly -- never the user's only chance to name it. */
export async function renameDevice(id: string, name: string): Promise<void> {
  const resp = await apiFetch(`/v1/devices/mine/${encodeURIComponent(id)}/name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!resp.ok) throw await errorFrom(resp)
}
