import { useEffect, useState } from 'react'
import {
  cloneProfile, deleteProfile, getProfile, listProfiles,
  type Profile, type ProfileInput,
} from '../api/profiles'
import { emptyProfileInput, toEditableInput } from './profileForm'
import { ProfileEditor } from './ProfileEditor'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { Modal } from '../ui/Modal'
import './Profiles.css'

type Editing = { mode: 'create' | 'edit'; initial: ProfileInput } | null

export function Profiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [cloneOf, setCloneOf] = useState<string | null>(null)
  const [cloneName, setCloneName] = useState('')

  function refresh(): void {
    listProfiles().then(setProfiles).catch((e) => setError((e as Error).message))
  }
  useEffect(refresh, [])

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
      {error && <p role="alert" className="pe__error">{error}</p>}
      <div className="profiles__row">
        <h2>Profiles</h2>
        <Button variant="primary"
          onClick={() => setEditing({ mode: 'create', initial: emptyProfileInput() })}>New</Button>
      </div>

      <section>
        {/* "My profiles", not "Mine" -- a profile's nickname can legitimately
            be "Mine" (see Profiles.test.tsx fixture), which would collide
            with getByText queries against a bare "Mine" heading. */}
        <h3>My profiles</h3>
        {mine.map((p) => (
          <div className="profiles__row" key={p.name}>
            <span>{p.nickname || p.name}</span>
            <span>
              <button data-act="edit" className="btn btn--secondary" onClick={() => openEdit(p.name)}>Edit</button>
              <button data-act="clone" className="btn btn--secondary"
                onClick={() => { setCloneOf(p.name); setCloneName(`${p.name}-copy`) }}>Clone</button>
              <button data-act="delete" className="btn btn--danger" onClick={() => setToDelete(p.name)}>Delete</button>
            </span>
          </div>
        ))}
      </section>

      <section>
        <h3>Shared templates</h3>
        {shared.map((p) => (
          <div className="profiles__row" key={p.name}>
            <span>{p.nickname || p.name} <span className="profiles__badge">shared</span></span>
            <button data-act="clone" className="btn btn--secondary"
              onClick={() => { setCloneOf(p.name); setCloneName(`${p.name}-copy`) }}>Clone</button>
          </div>
        ))}
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
          <input aria-label="Clone new name" value={cloneName}
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
