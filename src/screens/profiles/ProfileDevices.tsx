import { useCallback, useEffect, useState } from 'react'
import { listDevices, type Device } from '../../api/devices'
import { listProfiles, type Profile } from '../../api/profiles'
import { Button } from '../../ui/Button'
import { ConfirmModal } from '../../ui/ConfirmModal'
import { DeviceRow } from '../devices/DeviceRow'
import { MoveDeviceModal } from '../devices/MoveDeviceModal'
import { PairWizard } from '../devices/PairWizard'
import { RenameDeviceModal } from '../devices/RenameDeviceModal'
import { useDeviceActions } from '../devices/useDeviceActions'
import '../devices/devices.css'

/** The devices belonging to one assistant.
 *
 * Reached from that assistant's card, so the assistant is context rather than
 * something to pick: pairing here binds to it, and moving away from it is an
 * explicit, named action.
 */
export function ProfileDevices({
  profileName,
  onBack,
}: {
  profileName: string
  onBack: () => void
}) {
  const [devices, setDevices] = useState<Device[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)

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
    // A failed profile list only costs the Move picker its options, so it must
    // not block the device list itself.
    listProfiles().then(setProfiles).catch(() => setProfiles([]))
  }, [refresh])

  const profile = profiles.find((p) => p.name === profileName)
  const title = profile?.nickname || profileName
  const mine = devices.filter((d) => !d.revoked && d.profile_id === profileName)

  return (
    <main className="page">
      <div className="page__back">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ‹ Assistants
        </Button>
      </div>
      <div className="page__head">
        <h1 className="page__title">Devices</h1>
        {/* Compact and in the header, not a full-width bar under the list: adding
            a device happens once per device, the list is what you came for. */}
        <Button variant="primary" size="sm" onClick={() => setPairing(true)}>
          Add device
        </Button>
      </div>
      <p className="page__sub">Hardware running {title}.</p>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {mine.length === 0 ? (
        <p className="empty">
          No devices yet. Add one and it will answer as {title}.
        </p>
      ) : (
        <ul className="list dev__list">
          {mine.map((d) => (
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
      )}

      <PairWizard
        open={pairing}
        profileId={profileName}
        profileTitle={title}
        onCancel={() => setPairing(false)}
        onPaired={() => {
          setPairing(false)
          void refresh()
        }}
      />

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
