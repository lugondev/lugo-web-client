import { useEffect, useState } from 'react'
import { deleteSession, getSession, listSessions, type SessionDetail, type SessionRow } from '../api/history'
import { relativeTime } from '../lib/time'
import './History.css'

function Detail({ id, onBack, onDeleted }: { id: string; onBack: () => void; onDeleted: () => void }) {
  const [data, setData] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let alive = true
    getSession(id)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Không tải được'))
    return () => {
      alive = false
    }
  }, [id])

  async function remove() {
    try {
      await deleteSession(id)
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xoá không thành công')
    }
  }

  return (
    <main className="his">
      <div className="his__bar">
        <button className="his__btn" onClick={onBack}>
          Quay lại
        </button>
        {confirming ? (
          <span style={{ display: 'flex', gap: 6 }}>
            <button className="his__btn his__btn--danger" onClick={remove}>
              Xoá thật
            </button>
            <button className="his__btn" onClick={() => setConfirming(false)}>
              Thôi
            </button>
          </span>
        ) : (
          <button className="his__btn his__btn--danger" onClick={() => setConfirming(true)}>
            Xoá
          </button>
        )}
      </div>

      {error && (
        <p className="his__err" role="alert">
          {error}
        </p>
      )}

      {data && data.messages.length === 0 && (
        <p className="his__empty">Cuộc trò chuyện này không có nội dung nào.</p>
      )}

      {data && data.messages.length > 0 && (
        <div className="his__turns">
          {data.messages.map((m, i) => (
            <div className={`his__turn his__turn--${m.role}`} key={`${m.turn}-${i}`}>
              <p className="his__who">{m.role === 'user' ? 'Bạn' : 'Lugo'}</p>
              <p className="his__said">{m.content}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export function History() {
  const [rows, setRows] = useState<SessionRow[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      // Server đã sắp theo created_at DESC -- không sắp lại ở client.
      setRows(await listSessions(50))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được lịch sử')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  if (open) {
    return (
      <Detail
        id={open}
        onBack={() => setOpen(null)}
        onDeleted={() => {
          setOpen(null)
          void refresh()
        }}
      />
    )
  }

  return (
    <main className="his">
      <h1 className="his__h">Lịch sử</h1>
      <p className="his__sub">Những gì bạn và Lugo đã nói với nhau.</p>

      {error && (
        <p className="his__err" role="alert">
          {error}
        </p>
      )}

      {!error && rows.length === 0 ? (
        <p className="his__empty">Chưa có cuộc trò chuyện nào. Sang mục Nói để bắt đầu.</p>
      ) : (
        <ul className="his__list">
          {rows.map((r) => (
            <li key={r.id}>
              <button className="his__row" onClick={() => setOpen(r.id)}>
                <p className="his__preview">{r.preview || 'Không có nội dung'}</p>
                <p className="his__meta">
                  {relativeTime(r.created_at)} · {r.message_count} tin nhắn
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
