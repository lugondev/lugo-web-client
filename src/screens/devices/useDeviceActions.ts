import { useState } from 'react'
import { renameDevice, revokeDevice, setDeviceProfile, type Device } from '../../api/devices'

/** Move, remove, and rename, for the two screens that list devices.
 *
 * `AllDevices` and `ProfileDevices` are near-twins: same rows, same actions,
 * different filters. They carried byte-identical copies of this state and these
 * handlers, which is exactly the kind of pair that drifts. One hook, two callers.
 *
 * Failures are deliberately routed to two different places, matching what the
 * screens already did: a failed move or a failed rename stays in its own dialog
 * (the user is in it, and can retry), while a failed removal goes to the
 * page-level banner via `onRemoveError` (its confirm dialog has nowhere to put
 * a message). `remove` also clears that banner via `onRemoveError(null)` the
 * moment a new attempt starts, the same way `move` and `rename` clear their own
 * error at the top of the call -- otherwise a stale "Removal failed" from an
 * earlier try could sit on the page through a removal that actually succeeds.
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
  const [renaming, setRenaming] = useState<Device | null>(null)
  const [renameBusy, setRenameBusy] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

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

  async function rename(name: string) {
    if (!renaming) return
    setRenameBusy(true)
    setRenameError(null)
    try {
      await renameDevice(renaming.id, name)
      setRenaming(null)
      await refresh()
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : 'Could not rename the device')
    } finally {
      setRenameBusy(false)
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
    renaming,
    renameBusy,
    renameError,
    // Opening clears any error left from a previous attempt, so a stale message
    // never greets the next device the user picks.
    openRename: (device: Device) => {
      setRenameError(null)
      setRenaming(device)
    },
    closeRename: () => setRenaming(null),
    rename,
  }
}
