import { useEffect, useState } from 'react'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { TextInput } from '../../ui/TextInput'
import type { Device } from '../../api/devices'

/** Rename a paired device.
 *
 * Its own component rather than inline in the row, because DeviceRow has two
 * parents -- the per-assistant list and the all-devices view -- and both offer
 * the action. MoveDeviceModal is shared for the same reason; a second copy of
 * either would drift.
 */
export function RenameDeviceModal({
  device,
  busy = false,
  error,
  onCancel,
  onConfirm,
}: {
  device: Device | null
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (name: string) => void
}) {
  const [name, setName] = useState('')

  // Reopen on whatever the device is called today, so the field always starts
  // from the truth rather than from the last device the user opened.
  useEffect(() => {
    setName(device?.name ?? '')
  }, [device])

  return (
    // Escape and the backdrop click go through this same onClose; make dismissal
    // a no-op while the rename request is in flight, otherwise the dialog can
    // unmount mid-request and the later setRenameError(...) lands on nothing --
    // the rename fails and the user is never told. PairWizard closes the same
    // hole on its own onClose.
    <Modal
      open={device !== null}
      onClose={busy ? () => {} : onCancel}
      title={`Rename "${device?.name ?? ''}"`}
    >
      <TextInput
        id="rename-device"
        label="Device name"
        value={name}
        maxLength={128}
        onChange={(e) => setName(e.target.value)}
      />
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <div className="modal__actions">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onConfirm(name.trim())}
          disabled={busy || !name.trim()}
        >
          {busy ? 'Renaming…' : 'Rename'}
        </Button>
      </div>
    </Modal>
  )
}
