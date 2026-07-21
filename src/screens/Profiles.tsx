import { useEffect, useState } from 'react'
import {
  cloneProfile, deleteProfile, getProfile, listProfiles, listLlmOptions,
  type Profile, type ProfileInput, type LlmOption,
} from '../api/profiles'
import { listSttModelOptions, type SttModelOption } from '../api/stt'
import { listTtsProfiles, type TtsProfileSummary } from '../api/tts'
import { emptyProfileInput, toEditableInput } from './profileForm'
import { ProfileEditor } from './ProfileEditor'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Modal } from '../ui/Modal'
import './Profiles.css'

type Editing = { mode: 'create' | 'edit'; initial: ProfileInput } | null

// The user-facing summary shows only the Model Registry label — never the raw
// engine name or model id. A profile stores (engine, model), so we resolve each
// pair back to its label via the same options lists the editor's dropdowns use.
// Empty engine = server default; a pair with no matching registry row = unavailable.
type Catalog = { llm: LlmOption[]; stt: SttModelOption[]; tts: TtsProfileSummary[] }

function ProfileMeta({ p, catalog }: { p: Profile; catalog: Catalog }) {
  const llmLabel = !p.llm.engine ? '—'
    : catalog.llm.find((o) => o.engine === p.llm.engine && o.model_id === p.llm.model)?.label ?? 'Unavailable'
  const sttLabel = !p.stt.engine ? '—'
    : catalog.stt.find((o) => o.engine === p.stt.engine && o.model === p.stt.model)?.label ?? 'Unavailable'
  const ttsProfile = catalog.tts.find((t) => t.name === p.tts.profile_name)
  const ttsLabel = !p.tts.profile_name ? '—' : (ttsProfile?.nickname || ttsProfile?.name || 'Unavailable')
  return (
    <p className="profiles__meta">
      <span>LLM {llmLabel}</span>
      <span>STT {sttLabel}</span>
      <span>TTS {ttsLabel}</span>
    </p>
  )
}

export function Profiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [cloneOf, setCloneOf] = useState<string | null>(null)
  const [cloneName, setCloneName] = useState('')
  const [catalog, setCatalog] = useState<Catalog>({ llm: [], stt: [], tts: [] })

  function refresh(): void {
    setError(null)
    listProfiles().then(setProfiles).catch((e) => setError((e as Error).message))
  }
  useEffect(refresh, [])
  // Labels for the summary come from the registry; load once. A failed list just
  // falls back to "Unavailable" for that column rather than blocking the page.
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

  const shared = profiles.filter((p) => p.owner_id === null)
  const mine = profiles.filter((p) => p.owner_id !== null)

  return (
    <main className="profiles">
      <div className="profiles__head">
        <h1 className="profiles__h">Profiles</h1>
        <Button variant="primary" size="sm"
          onClick={() => setEditing({ mode: 'create', initial: emptyProfileInput() })}>New</Button>
      </div>
      <p className="profiles__sub">Assistant configurations you can switch between.</p>

      {error && <p role="alert" className="pe__error">{error}</p>}

      <section className="profiles__section">
        {/* "My profiles", not "Mine" -- a profile's nickname can legitimately
            be "Mine" (see Profiles.test.tsx fixture), which would collide
            with getByText queries against a bare "Mine" heading. */}
        <h2 className="profiles__section-h">My profiles</h2>
        {mine.length === 0 ? (
          <p className="profiles__empty">No profiles yet. Tap New to create one.</p>
        ) : (
          <div className="profiles__list">
            {mine.map((p) => (
              <Card className="profiles__row" key={p.name}>
                <div className="profiles__rowtop">
                  <span className="profiles__name">{p.nickname || p.name}</span>
                  <span className="profiles__actions">
                    <Button data-act="edit" variant="secondary" size="sm" onClick={() => openEdit(p.name)}>Edit</Button>
                    <Button data-act="clone" variant="secondary" size="sm"
                      onClick={() => { setCloneOf(p.name); setCloneName(`${p.name}-copy`) }}>Clone</Button>
                    <Button data-act="delete" variant="danger" size="sm" onClick={() => setToDelete(p.name)}>Delete</Button>
                  </span>
                </div>
                <ProfileMeta p={p} catalog={catalog} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="profiles__section">
        <h2 className="profiles__section-h">Shared templates</h2>
        {shared.length === 0 ? (
          <p className="profiles__empty">No shared templates.</p>
        ) : (
          <div className="profiles__list">
            {shared.map((p) => (
              <Card className="profiles__row" key={p.name}>
                <div className="profiles__rowtop">
                  <span className="profiles__name">{p.nickname || p.name} <span className="profiles__badge">shared</span></span>
                  <Button data-act="clone" variant="secondary" size="sm"
                    onClick={() => { setCloneOf(p.name); setCloneName(`${p.name}-copy`) }}>Clone</Button>
                </div>
                <ProfileMeta p={p} catalog={catalog} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={toDelete !== null}
        title={`Delete "${toDelete ?? ''}"?`}
        message="This permanently removes the profile."
        confirmLabel="Yes, delete"
        destructive
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />

      <Modal open={cloneOf !== null} title={`Clone "${cloneOf ?? ''}"`} onClose={() => setCloneOf(null)}>
        <label className="pe__field">New name
          <input className="input" aria-label="Clone new name" value={cloneName}
            onChange={(e) => setCloneName(e.target.value)} />
        </label>
        <div className="pe__actions">
          <Button variant="secondary" onClick={() => setCloneOf(null)}>Cancel</Button>
          <Button variant="primary" onClick={doClone}>Clone</Button>
        </div>
      </Modal>
    </main>
  )
}
