import { useEffect, useState } from 'react'
import {
  cloneProfile, deleteProfile, getProfile, listProfiles, listLlmOptions,
  type Profile, type ProfileInput, type LlmOption,
} from '../api/profiles'
import { listDevices, type Device } from '../api/devices'
import { listSessions } from '../api/history'
import { listSttModelOptions, type SttModelOption } from '../api/stt'
import { listTtsProfiles, type TtsProfileSummary } from '../api/tts'
import { relativeTime } from '../lib/time'
import { emptyProfileInput, toEditableInput } from './profileForm'
import { ProfileCard, type ProfileMeta } from './profiles/ProfileCard'
import { ProfileEditor } from './ProfileEditor'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Modal } from '../ui/Modal'
import './Profiles.css'

type Editing = { mode: 'create' | 'edit'; initial: ProfileInput } | null

// Labels shown on a card come from the Model Registry / TTS profile list, never
// from the raw engine + model id the profile stores. A profile keeps
// (engine, model); these lists turn that pair back into something a person
// recognises. Empty engine = server default; a pair with no matching row =
// unavailable (the model was removed from the registry).
type Catalog = { llm: LlmOption[]; stt: SttModelOption[]; tts: TtsProfileSummary[] }

// How many recent sessions to scan for "last used". One request for the whole
// grid instead of one per card. Assistants missing from this page are shown as
// "Not recently" -- deliberately NOT "never", which a truncated page cannot
// establish.
const RECENT_SESSION_SCAN = 100

function metaFor(p: Profile, catalog: Catalog, lastUsedIso: string | null): ProfileMeta {
  const model = !p.llm.engine
    ? 'Server default'
    : catalog.llm.find((o) => o.engine === p.llm.engine && o.model_id === p.llm.model)?.label
      ?? 'Unavailable'
  const hearing = !p.stt.engine
    ? 'Server default'
    : catalog.stt.find((o) => o.engine === p.stt.engine && o.model === p.stt.model)?.label
      ?? 'Unavailable'
  const ttsProfile = catalog.tts.find((t) => t.name === p.tts.profile_name)
  const voice = !p.tts.profile_name
    ? 'Server default'
    : ttsProfile?.nickname || ttsProfile?.name || 'Unavailable'
  return {
    hearing,
    voice,
    model,
    // Short enough to survive a third of a card: the longer wording ellipsised
    // to "Not used rece…" on every card that had never run.
    lastUsed: lastUsedIso ? relativeTime(lastUsedIso) : 'Not recently',
  }
}

export function Profiles({
  onOpenDevices,
  onOpenHistory,
}: {
  onOpenDevices: (profileName: string) => void
  onOpenHistory: (profileName: string, title: string) => void
}) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [cloneOf, setCloneOf] = useState<string | null>(null)
  const [cloneName, setCloneName] = useState('')
  const [catalog, setCatalog] = useState<Catalog>({ llm: [], stt: [], tts: [] })
  const [devices, setDevices] = useState<Device[]>([])
  const [lastUsed, setLastUsed] = useState<Record<string, string>>({})

  function refresh(): void {
    setError(null)
    listProfiles().then(setProfiles).catch((e) => setError((e as Error).message))
    // Device counts and last-used are decoration on the cards: a failure there
    // must not blank the list of assistants, so each falls back to "nothing
    // known" rather than surfacing an error.
    listDevices().then(setDevices).catch(() => setDevices([]))
    listSessions(RECENT_SESSION_SCAN)
      .then((rows) => {
        const newest: Record<string, string> = {}
        for (const row of rows) {
          if (!row.profile_id || !row.created_at) continue
          const seen = newest[row.profile_id]
          if (!seen || row.created_at > seen) newest[row.profile_id] = row.created_at
        }
        setLastUsed(newest)
      })
      .catch(() => setLastUsed({}))
  }
  useEffect(refresh, [])
  // Registry labels change rarely; load once. A failed list just falls back to
  // "Unavailable" for that column rather than blocking the page.
  useEffect(() => {
    Promise.all([
      listLlmOptions().catch(() => []),
      listSttModelOptions().catch(() => []),
      listTtsProfiles().catch(() => []),
    ]).then(([llm, stt, tts]) => setCatalog({ llm, stt, tts }))
  }, [])

  async function openEdit(name: string): Promise<void> {
    try { setEditing({ mode: 'edit', initial: toEditableInput(await getProfile(name)) }) }
    catch (e) { setError((e as Error).message) }
  }
  async function doDelete(): Promise<void> {
    if (!toDelete) return
    try { await deleteProfile(toDelete); refresh() }
    catch (e) { setError((e as Error).message) }
    finally { setToDelete(null) }
  }
  async function doClone(): Promise<void> {
    if (!cloneOf) return
    try { await cloneProfile(cloneOf, cloneName); refresh() }
    catch (e) { setError((e as Error).message); return }
    finally { setCloneOf(null); setCloneName('') }
  }

  if (editing) {
    return (
      <ProfileEditor mode={editing.mode} initial={editing.initial}
        onDone={() => { setEditing(null); refresh() }}
        onCancel={() => setEditing(null)} />
    )
  }

  const countFor = (name: string) =>
    devices.filter((d) => !d.revoked && d.profile_id === name).length

  const shared = profiles.filter((p) => p.owner_id === null)
  const mine = profiles.filter((p) => p.owner_id !== null)

  function card(p: Profile, isShared: boolean) {
    return (
      <ProfileCard
        key={p.name}
        profile={p}
        shared={isShared}
        meta={metaFor(p, catalog, lastUsed[p.name] ?? null)}
        deviceCount={countFor(p.name)}
        onConfigure={() => openEdit(p.name)}
        onHistory={() => onOpenHistory(p.name, p.nickname || p.name)}
        onDevices={() => onOpenDevices(p.name)}
        onDuplicate={() => { setCloneOf(p.name); setCloneName(`${p.name}-copy`) }}
        onDelete={isShared ? undefined : () => setToDelete(p.name)}
      />
    )
  }

  return (
    <main className="page page--wide">
      <div className="page__head">
        <h1 className="page__title">Assistants</h1>
        <Button variant="primary" size="sm"
          onClick={() => setEditing({ mode: 'create', initial: emptyProfileInput() })}>New</Button>
      </div>
      <p className="page__sub">Each assistant has its own voice, model, history and devices.</p>

      {error && <p role="alert" className="error-text">{error}</p>}

      <section className="profiles__section">
        {/* "My assistants", not "Mine" -- a nickname can legitimately be "Mine"
            (see Profiles.test.tsx fixture), which would collide with getByText
            queries against a bare "Mine" heading. */}
        <h2 className="eyebrow">My assistants</h2>
        {mine.length === 0 ? (
          <p className="empty">No assistants yet. Tap New to create one.</p>
        ) : (
          <div className="profiles__list">{mine.map((p) => card(p, false))}</div>
        )}
      </section>

      <section className="profiles__section">
        <h2 className="eyebrow">Shared templates</h2>
        {shared.length === 0 ? (
          <p className="empty">No shared templates.</p>
        ) : (
          <div className="profiles__list">{shared.map((p) => card(p, true))}</div>
        )}
      </section>

      <ConfirmModal
        open={toDelete !== null}
        title={`Delete "${toDelete ?? ''}"?`}
        message="This permanently removes the assistant. Devices running it keep their pairing and become unassigned."
        confirmLabel="Yes, delete"
        destructive
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />

      <Modal open={cloneOf !== null} title={`Duplicate "${cloneOf ?? ''}"`} onClose={() => setCloneOf(null)}>
        <label className="pe__field">New name
          <input className="input" aria-label="Clone new name" value={cloneName}
            onChange={(e) => setCloneName(e.target.value)} />
        </label>
        <div className="pe__actions">
          <Button variant="secondary" onClick={() => setCloneOf(null)}>Cancel</Button>
          <Button variant="primary" onClick={doClone}>Duplicate</Button>
        </div>
      </Modal>
    </main>
  )
}
