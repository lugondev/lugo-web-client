import { useEffect, useState } from 'react'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import type { Device } from '../../api/devices'
import type { Profile } from '../../api/profiles'

/** Reassign a device to a different assistant, or to none.
 *
 * "Unassigned" is offered as a first-class choice rather than hidden behind a
 * Remove button: dropping the assistant is a soft change that keeps the pairing,
 * and conflating it with revoking the token would cost the user a trip to the
 * hardware to read a fresh code.
 */
export function MoveDeviceModal({
  device,
  profiles,
  busy = false,
  error,
  onCancel,
  onConfirm,
}: {
  device: Device | null
  profiles: Profile[]
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (profileId: string) => void
}) {
  const [choice, setChoice] = useState('')

  // Open the picker on whatever the device runs today, so confirming without
  // touching the select is a no-op rather than a silent unassign.
  useEffect(() => {
    setChoice(device?.profile_id ?? '')
  }, [device])

  return (
    <Modal open={device !== null} onClose={onCancel} title={`Move "${device?.name ?? ''}"`}>
      <label className="field">
        <span className="field__label">Assistant</span>
        <select
          className="input"
          aria-label="Assistant"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="">Unassigned</option>
          {profiles.map((p) => (
            <option key={p.name} value={p.name}>
              {p.nickname || p.name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <div className="modal__actions">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={() => onConfirm(choice)} disabled={busy}>
          {busy ? 'Moving…' : 'Move'}
        </Button>
      </div>
    </Modal>
  )
}
