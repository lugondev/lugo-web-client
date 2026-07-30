const RECENT_MS = 90_000

function parse(iso: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/** Human-readable "last seen".
 *
 * Deliberately does NOT say "online": last_seen_at is only updated when the device opens
 * a WS, so it's a trace of the past, not real presence.
 */
export function relativeTime(iso: string | null, now: number = Date.now()): string {
  const t = parse(iso)
  if (t === null) return 'never connected'

  // Clamp to 0: clock skew between server and browser is common, and
  // "-3 min ago" makes users think the app is broken.
  const sec = Math.max(0, Math.floor((now - t) / 1000))
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`
  return `${Math.floor(sec / 86400)} d ago`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

/** When one message in a transcript was said, in the reader's own timezone.
 *
 * A transcript is read back in order, so the useful unit is the clock, not
 * "3 d ago". Anything from an earlier day carries its date too: a bare "09:05"
 * on a week-old conversation reads as this morning.
 *
 * Formatted by hand rather than via toLocaleTimeString: 24h with a stable
 * shape, so it lines up down the column and doesn't shift with the host locale.
 */
export function messageTime(iso: string | null | undefined, now: number = Date.now()): string {
  const t = parse(iso ?? null)
  if (t === null) return ''
  const d = new Date(t)
  const clock = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const today = new Date(now)
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  return sameDay ? clock : `${d.getDate()} ${MONTHS[d.getMonth()]} ${clock}`
}

export function isRecentlyActive(iso: string | null, now: number = Date.now()): boolean {
  const t = parse(iso)
  if (t === null) return false
  return now - t <= RECENT_MS && now - t >= -RECENT_MS
}
