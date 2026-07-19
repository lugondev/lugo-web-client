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

export function isRecentlyActive(iso: string | null, now: number = Date.now()): boolean {
  const t = parse(iso)
  if (t === null) return false
  return now - t <= RECENT_MS && now - t >= -RECENT_MS
}
