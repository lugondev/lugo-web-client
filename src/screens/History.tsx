import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteSession, getSession, listSessions, type SessionDetail, type SessionRow } from '../api/history'
import { listProfiles } from '../api/profiles'
import { messageTime, relativeTime } from '../lib/time'
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
  const [loading, setLoading] = useState(false)

  // A ref rather than an effect-scoped flag, because the Refresh button fires
  // outside any effect and still has to stop writing state after unmount.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getSession(id)
      if (alive.current) {
        setData(d)
        setError(null)
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Could not load')
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

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
          {/* The other side keeps talking while this transcript sits open. */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            aria-busy={loading}
          >
            Refresh
          </Button>
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
          {data.messages.map((m, i) => {
            const at = messageTime(m.created_at)
            return (
              <div className={`his__turn his__turn--${m.role}`} key={`${m.turn}-${i}`}>
                <p className="his__who">
                  {m.role === 'user' ? 'YOU' : 'LUGO'}
                  {at && <span className="his__at">{at}</span>}
                </p>
                <p className="his__said">{m.content}</p>
              </div>
            )
          })}
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
  onBack,
}: {
  onContinue: (id: string) => void
  profile?: string
  onBack?: () => void
}) {
  const [rows, setRows] = useState<SessionRow[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Resolved here rather than handed over by the hub: this screen has its own
  // URL, so it has to work when the hub was never rendered. Same pattern as
  // ProfileDevices. Until it arrives the slug stands in -- it is the assistant's
  // name often enough, and a heading that pops in beats one that pops from
  // nothing.
  const [title, setTitle] = useState<string | undefined>(profile)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      // The server already orders by created_at DESC -- don't re-sort on the client.
      setRows(await listSessions(50, 0, profile))
      setError(null)
    } catch (e) {
      // Keep whatever is on screen: a failed reload should not empty a list that
      // loaded fine a moment ago.
      setError(e instanceof Error ? e.message : 'Could not load history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  useEffect(() => {
    if (!profile) return
    setTitle(profile)
    // A failed lookup only costs the heading its nickname, so it must not
    // surface an error over a list that loaded fine.
    let alive = true
    listProfiles()
      .then((ps) => {
        if (alive) setTitle(ps.find((p) => p.name === profile)?.nickname || profile)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
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
        {/* Conversations are made on the devices, not here, so this list goes
            stale while the screen sits open. */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
          aria-busy={loading}
        >
          Refresh
        </Button>
      </div>
      <p className="page__sub">
        {title ? `Conversations with ${title}.` : 'Everything you and Lugo have said.'}
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
