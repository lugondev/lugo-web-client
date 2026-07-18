const RECENT_MS = 90_000

function parse(iso: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/** "lần cuối thấy" dạng người đọc được.
 *
 * Cố ý KHÔNG nói "online": last_seen_at chỉ được cập nhật khi thiết bị mở WS,
 * nên nó là dấu vết quá khứ, không phải hiện diện thật.
 */
export function relativeTime(iso: string | null, now: number = Date.now()): string {
  const t = parse(iso)
  if (t === null) return 'never connected'

  // Kẹp về 0: lệch đồng hồ server/trình duyệt là chuyện thường, và
  // "-3 phút trước" khiến người dùng tưởng app hỏng.
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
