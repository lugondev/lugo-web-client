import { useCallback, useEffect, useState } from 'react'
import { listDevices, type Device } from '../../api/devices'
import { listProfiles, type Profile } from '../../api/profiles'
import { Button } from '../../ui/Button'
import { ConfirmModal } from '../../ui/ConfirmModal'
import { DeviceRow } from '../devices/DeviceRow'
import { MoveDeviceModal } from '../devices/MoveDeviceModal'
import { RenameDeviceModal } from '../devices/RenameDeviceModal'
import { useDeviceActions } from '../devices/useDeviceActions'
import '../devices/devices.css'

const UNASSIGNED = ' unassigned'

/** Every paired device, grouped by the assistant it runs.
 *
 * The per-assistant lists cannot show a device whose assistant was deleted or
 * never set, so this is the only place an orphaned device is visible -- hence the
 * Unassigned group is always rendered when it has members, never folded away.
 *
 * There is no "add device" here on purpose: pairing starts from an assistant, so
 * a device is never created without one.
 */
export function AllDevices({ onBack }: { onBack: () => void }) {
  const [devices, setDevices] = useState<Device[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setDevices(await listDevices())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load devices')
    }
  }, [])
  const actions = useDeviceActions(refresh, setError)

  useEffect(() => {
    void refresh()
    listProfiles().then(setProfiles).catch(() => setProfiles([]))
  }, [refresh])

  const active = devices.filter((d) => !d.revoked)
  const titleOf = (name: string) =>
    profiles.find((p) => p.name === name)?.nickname || name

  // Group keys come from the devices themselves, not from the profile list, so a
  // device pointing at an assistant that no longer exists still appears (under
  // its stale name) instead of vanishing from every view.
  const groups = new Map<string, Device[]>()
  for (const d of active) {
    const key = d.profile_id || UNASSIGNED
    groups.set(key, [...(groups.get(key) ?? []), d])
  }
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === UNASSIGNED) return 1
    if (b === UNASSIGNED) return -1
    return titleOf(a).localeCompare(titleOf(b))
  })

  return (
    <main className="page">
      <div className="page__back">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ‹ Settings
        </Button>
      </div>
      <div className="page__head">
        <h1 className="page__title">All devices</h1>
      </div>
      <p className="page__sub">Every device paired to your account, by assistant.</p>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {active.length === 0 ? (
        <p className="empty">
          No devices yet. Open an assistant and add one there.
        </p>
      ) : (
        keys.map((key) => (
          <section key={key}>
            <h2 className="eyebrow dev__group">
              {key === UNASSIGNED ? 'Unassigned' : titleOf(key)}
            </h2>
            <ul className="list dev__list">
              {(groups.get(key) ?? []).map((d) => (
                <li key={d.id}>
                  <DeviceRow
                    device={d}
                    onMove={() => actions.openMove(d)}
                    onRemove={() => actions.openRemove(d)}
                    onRename={() => actions.openRename(d)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <MoveDeviceModal
        device={actions.moving}
        profiles={profiles}
        busy={actions.moveBusy}
        error={actions.moveError}
        onCancel={actions.closeMove}
        onConfirm={actions.move}
      />

      <RenameDeviceModal
        device={actions.renaming}
        busy={actions.renameBusy}
        error={actions.renameError}
        onCancel={actions.closeRename}
        onConfirm={actions.rename}
      />

      <ConfirmModal
        open={actions.removing !== null}
        title="Remove device?"
        message={`${actions.removing?.name ?? 'This device'} will lose access and have to be paired again.`}
        confirmLabel="Remove"
        destructive
        busy={actions.removeBusy}
        onConfirm={actions.remove}
        onCancel={actions.closeRemove}
      />
    </main>
  )
}
