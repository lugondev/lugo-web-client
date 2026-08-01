import { useState } from 'react'
import { revokeDevice, setDeviceProfile, type Device } from '../../api/devices'

/** Move and remove, for the two screens that list devices.
 *
 * `AllDevices` and `ProfileDevices` are near-twins: same rows, same actions,
 * different filters. They carried byte-identical copies of this state and these
 * handlers, which is exactly the kind of pair that drifts. One hook, two callers.
 *
 * Failures are deliberately routed to two different places, matching what the
 * screens already did: a failed move stays in the move dialog (the user is in it,
 * and can retry), while a failed removal goes to the page-level banner via
 * `onRemoveError` (its confirm dialog has nowhere to put a message). `remove`
 * also clears that banner via `onRemoveError(null)` the moment a new attempt
 * starts, the same way `move` clears its own error at the top of `move` --
 * otherwise a stale "Removal failed" from an earlier try could sit on the page
 * through a removal that actually succeeds.
 */
export function useDeviceActions(
  refresh: () => Promise<void>,
  onRemoveError: (message: string | null) => void,
) {
  const [moving, setMoving] = useState<Device | null>(null)
  const [moveBusy, setMoveBusy] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Device | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  async function move(targetProfileId: string) {
    if (!moving) return
    setMoveBusy(true)
    setMoveError(null)
    try {
      await setDeviceProfile(moving.id, targetProfileId)
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
    onRemoveError(null)
    try {
      await revokeDevice(removing.id)
      setRemoving(null)
      await refresh()
    } catch (e) {
      onRemoveError(e instanceof Error ? e.message : 'Removal failed')
    } finally {
      setRemoveBusy(false)
    }
  }

  return {
    moving,
    moveBusy,
    moveError,
    // Opening clears any error left from a previous attempt, so a stale message
    // never greets the next device the user picks.
    openMove: (device: Device) => {
      setMoveError(null)
      setMoving(device)
    },
    closeMove: () => setMoving(null),
    move,
    removing,
    removeBusy,
    openRemove: (device: Device) => setRemoving(device),
    closeRemove: () => setRemoving(null),
    remove,
  }
}
