import { useEffect, useState } from 'react'
import { claimDevice, listDevices, revokeDevice, type Device } from '../api/devices'
import { isRecentlyActive, relativeTime } from '../lib/time'
import './Devices.css'

export function Devices() {
  const [items, setItems] = useState<Device[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)

  async function refresh() {
    try {
      setItems(await listDevices())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách thiết bị')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function pair(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await claimDevice(code.trim(), name.trim())
      setCode('')
      setName('')
      await refresh()
    } catch (err) {
      // Giữ nguyên chữ của server: nó phân biệt "mã sai" với "phần cứng đã
      // ghép rồi", và hai lỗi đó cần hai hành động khác nhau.
      setError(err instanceof Error ? err.message : 'Ghép không thành công')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      await revokeDevice(id)
      setConfirming(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gỡ không thành công')
    }
  }

  const active = items.filter((d) => !d.revoked)

  return (
    <main className="dev">
      <h1 className="dev__h">Thiết bị</h1>
      <p className="dev__sub">Thiết bị đã ghép sẽ nói chuyện với Lugo bằng tài khoản của bạn.</p>

      {active.length === 0 ? (
        <p className="dev__empty">
          Chưa có thiết bị nào. Bật thiết bị Lugo lên — nó sẽ hiện một mã gồm 6 chữ số. Nhập mã đó
          xuống dưới.
        </p>
      ) : (
        <ul className="dev__list">
          {active.map((d) => (
            <li className="dev__item" key={d.id}>
              <div>
                <p className="dev__name">{d.name}</p>
                <p className="dev__meta">
                  {isRecentlyActive(d.last_seen_at)
                    ? 'Đang hoạt động'
                    : `Lần cuối thấy: ${relativeTime(d.last_seen_at)}`}
                </p>
                <p className="dev__serial">{d.serial}</p>
              </div>
              {confirming === d.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="dev__btn dev__btn--danger" onClick={() => remove(d.id)}>
                    Gỡ thật
                  </button>
                  <button className="dev__btn" onClick={() => setConfirming(null)}>
                    Thôi
                  </button>
                </div>
              ) : (
                <button className="dev__btn dev__btn--danger" onClick={() => setConfirming(d.id)}>
                  Gỡ
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="dev__form" onSubmit={pair}>
        <input
          className="dev__input dev__code"
          aria-label="Mã 6 chữ số"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
        />
        <input
          className="dev__input"
          aria-label="Tên thiết bị"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Đặt tên, ví dụ: Loa bếp"
        />
        {error && (
          <p className="dev__err" role="alert">
            {error}
          </p>
        )}
        <button
          className="dev__btn dev__btn--primary"
          type="submit"
          disabled={busy || code.length !== 6 || !name.trim()}
        >
          {busy ? 'Đang ghép...' : 'Ghép thiết bị'}
        </button>
      </form>
    </main>
  )
}
