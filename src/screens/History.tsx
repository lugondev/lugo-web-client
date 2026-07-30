import { useEffect, useState } from 'react'
import { deleteSession, getSession, listSessions, type SessionDetail, type SessionRow } from '../api/history'
import { relativeTime } from '../lib/time'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import './History.css'

function Detail({
  id,
  onBack,
  onDeleted,
  onContinue,
}: { id: string; onBack: () => void; onDeleted: () => void; onContinue: (id: string) => void }) {
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
    <main className="page">
      <div className="his__bar">
        <Button variant="secondary" size="sm" onClick={onBack}>
          Back
        </Button>
        <div className="his__bar-right">
          <Button variant="primary" size="sm" onClick={() => onContinue(id)}>
            Continue
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </div>
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {data && data.messages.length === 0 && (
        <p className="empty">This conversation has no content.</p>
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

/** Conversations, scoped to one assistant.
 *
 * There is no global history screen any more: history belongs to the assistant
 * that produced it, so it is reached from that assistant's card. `profile` is
 * optional only so the component still renders standalone in tests.
 */
export function History({
  onContinue,
  profile,
  profileTitle,
  onBack,
}: {
  onContinue: (id: string) => void
  profile?: string
  profileTitle?: string
  onBack?: () => void
}) {
  const [rows, setRows] = useState<SessionRow[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      // The server already orders by created_at DESC -- don't re-sort on the client.
      setRows(await listSessions(50, 0, profile))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load history')
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  if (open) {
    return (
      <Detail
        id={open}
        onBack={() => setOpen(null)}
        onDeleted={() => {
          setOpen(null)
          void refresh()
        }}
        onContinue={onContinue}
      />
    )
  }

  return (
    <main className="page">
      {onBack && (
        <div className="page__back">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ‹ Assistants
          </Button>
        </div>
      )}
      <div className="page__head">
        <h1 className="page__title">History</h1>
      </div>
      <p className="page__sub">
        {profileTitle ? `Conversations with ${profileTitle}.` : 'Everything you and Lugo have said.'}
      </p>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {!error && rows.length === 0 ? (
        <p className="empty">No conversations yet. Head to Talk to start.</p>
      ) : (
        <ul className="list his__list">
          {rows.map((r) => (
            <li key={r.id} className="his__item">
              <button className="his__row" onClick={() => setOpen(r.id)}>
                <p className="his__preview">{r.preview || 'No content'}</p>
                <p className="his__meta">
                  {relativeTime(r.created_at)} · {r.message_count} messages
                </p>
              </button>
              <Button variant="secondary" size="sm" className="his__continue" onClick={() => onContinue(r.id)}>
                Continue
              </Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
