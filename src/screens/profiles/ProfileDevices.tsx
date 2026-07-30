import { useCallback, useEffect, useState } from 'react'
import { listDevices, revokeDevice, setDeviceProfile, type Device } from '../../api/devices'
import { listProfiles, type Profile } from '../../api/profiles'
import { Button } from '../../ui/Button'
import { ConfirmModal } from '../../ui/ConfirmModal'
import { DeviceRow } from '../devices/DeviceRow'
import { MoveDeviceModal } from '../devices/MoveDeviceModal'
import { PairWizard } from '../devices/PairWizard'
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
  const [moving, setMoving] = useState<Device | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [moveBusy, setMoveBusy] = useState(false)
  const [removing, setRemoving] = useState<Device | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setDevices(await listDevices())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load devices')
    }
  }, [])

  useEffect(() => {
    void refresh()
    // A failed profile list only costs the Move picker its options, so it must
    // not block the device list itself.
    listProfiles().then(setProfiles).catch(() => setProfiles([]))
  }, [refresh])

  const profile = profiles.find((p) => p.name === profileName)
  const title = profile?.nickname || profileName
  const mine = devices.filter((d) => !d.revoked && d.profile_id === profileName)

  async function move(target: string) {
    if (!moving) return
    setMoveBusy(true)
    setMoveError(null)
    try {
      await setDeviceProfile(moving.id, target)
      setMoving(null)
      await refresh()
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : 'Could not move the device')
    } finally {
      setMoveBusy(false)
    }
  }

  async function remove() {
    if (!removing) return
    setRemoveBusy(true)
    setError(null)
    try {
      await revokeDevice(removing.id)
      setRemoving(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Removal failed')
    } finally {
      setRemoveBusy(false)
    }
  }

  return (
    <main className="dev">
      <div className="dev__bar">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ‹ Assistants
        </Button>
      </div>
      <h1 className="dev__h">Devices</h1>
      <p className="dev__sub">Hardware running {title}.</p>

      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}

      {mine.length === 0 ? (
        <p className="dev__empty">
          No devices yet. Add one and it will answer as {title}.
        </p>
      ) : (
        <ul className="dev__list">
          {mine.map((d) => (
            <li key={d.id}>
              <DeviceRow
                device={d}
                onMove={() => {
                  setMoveError(null)
                  setMoving(d)
                }}
                onRemove={() => setRemoving(d)}
              />
            </li>
          ))}
        </ul>
      )}

      <Button variant="primary" fullWidth onClick={() => setPairing(true)}>
        + Add device
      </Button>

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
        device={moving}
        profiles={profiles}
        busy={moveBusy}
        error={moveError}
        onCancel={() => setMoving(null)}
        onConfirm={move}
      />

      <ConfirmModal
        open={removing !== null}
        title="Remove device?"
        message={`${removing?.name ?? 'This device'} will lose access and have to be paired again.`}
        confirmLabel="Remove"
        destructive
        busy={removeBusy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </main>
  )
}
