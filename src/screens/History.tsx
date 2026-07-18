import { useEffect, useState } from 'react'
import { deleteSession, getSession, listSessions, type SessionDetail, type SessionRow } from '../api/history'
import { relativeTime } from '../lib/time'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import './History.css'

function Detail({ id, onBack, onDeleted }: { id: string; onBack: () => void; onDeleted: () => void }) {
  const [data, setData] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    let alive = true
    getSession(id)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load'))
    return () => {
      alive = false
    }
  }, [id])

  async function remove() {
    setRemoving(true)
    try {
      await deleteSession(id)
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <main className="his">
      <div className="his__bar">
        <Button variant="secondary" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      </div>

      {error && (
        <p className="his__err" role="alert">
          {error}
        </p>
      )}

      {data && data.messages.length === 0 && (
        <p className="his__empty">This conversation has no content.</p>
      )}

      {data && data.messages.length > 0 && (
        <div className="his__turns">
          {data.messages.map((m, i) => (
            <div className={`his__turn his__turn--${m.role}`} key={`${m.turn}-${i}`}>
              <p className="his__who">{m.role === 'user' ? 'YOU' : 'LUGO'}</p>
              <p className="his__said">{m.content}</p>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={confirming}
        title="Delete conversation?"
        message="This can't be undone."
        confirmLabel="Delete"
        destructive
        busy={removing}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
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
      setError(e instanceof Error ? e.message : 'Could not load history')
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
      <h1 className="his__h">History</h1>
      <p className="his__sub">Everything you and Lugo have said.</p>

      {error && (
        <p className="his__err" role="alert">
          {error}
        </p>
      )}

      {!error && rows.length === 0 ? (
        <p className="his__empty">No conversations yet. Head to Talk to start.</p>
      ) : (
        <ul className="his__list">
          {rows.map((r) => (
            <li key={r.id}>
              <button className="his__row" onClick={() => setOpen(r.id)}>
                <p className="his__preview">{r.preview || 'No content'}</p>
                <p className="his__meta">
                  {relativeTime(r.created_at)} · {r.message_count} messages
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
