import { useState } from 'react'
import {
  PAIR_CODE_LENGTH,
  claimDevice,
  friendlyDeviceError,
  renameDevice,
  type Device,
} from '../../api/devices'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { TextInput } from '../../ui/TextInput'

type Step = 'intro' | 'code' | 'done'

/** Pairing, as three steps that only exist while pairing.
 *
 * Replaces a claim form that was mounted under the device list permanently: a
 * once-per-device action took most of the screen forever, and it made the empty
 * state look like the populated one.
 *
 * The assistant is fixed by where the user opened this from, so it is never asked
 * for -- and it is sent with the claim itself, so there is no moment where the
 * device is paired but answers to nothing.
 *
 * The NAME is not asked for up front either. The device arrives already called
 * after its own setup AP (Lugo-XXXX, derived server-side from the pairing
 * serial), so the last step offers that name to edit instead of demanding one at
 * the moment the user knows the device least. Pairing is already committed by
 * then: a failed rename costs the name, never the pairing.
 */
export function PairWizard({
  open,
  profileId,
  profileTitle,
  onCancel,
  onPaired,
}: {
  open: boolean
  profileId: string
  profileTitle: string
  onCancel: () => void
  onPaired: () => void
}) {
  const [step, setStep] = useState<Step>('intro')
  const [code, setCode] = useState('')
  const [paired, setPaired] = useState<Device | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setStep('intro')
    setCode('')
    setPaired(null)
    setName('')
    setError(null)
  }

  function close() {
    reset()
    onCancel()
  }

  function finish() {
    reset()
    onPaired()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const device = await claimDevice(code.trim(), '', profileId)
      setPaired(device)
      setName(device.name)
      setStep('done')
    } catch (err) {
      // Keep the server's DISTINCTION between "wrong code" and "hardware already
      // paired": they call for two different actions from the user.
      setError(err instanceof Error ? friendlyDeviceError(err.message) : 'Pairing failed')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    const next = name.trim()
    // An untouched field is not an edit -- don't spend a request on it.
    if (!paired || !next || next === paired.name) return finish()
    setBusy(true)
    setError(null)
    try {
      await renameDevice(paired.id, next)
      finish()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename the device')
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<Step, string> = {
    intro: 'Add a device',
    code: `Pair with ${profileTitle}`,
    done: 'Device added',
  }

  return (
    <Modal open={open} onClose={close} title={titles[step]}>
      {step === 'intro' && (
        <>
          <p className="modal__body">
            Turn the device on and wait until it shows a {PAIR_CODE_LENGTH}-digit code. Codes
            last 10 minutes — restart the device if yours has expired.
          </p>
          <div className="modal__actions">
            <Button variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => setStep('code')}>
              I see a code
            </Button>
          </div>
        </>
      )}

      {step === 'code' && (
        <form className="pair__form" onSubmit={submit}>
          <TextInput
            id="pair-code"
            label={`${PAIR_CODE_LENGTH}-digit code`}
            className="pair__code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, PAIR_CODE_LENGTH))}
            placeholder={'0'.repeat(PAIR_CODE_LENGTH)}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
          <div className="modal__actions">
            <Button variant="ghost" size="sm" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={busy || code.length !== PAIR_CODE_LENGTH}
            >
              {busy ? 'Pairing…' : 'Pair device'}
            </Button>
          </div>
        </form>
      )}

      {step === 'done' && (
        <>
          <p className="modal__body">
            It now runs {profileTitle}. Change that any time from this assistant&apos;s device
            list — no re-pairing needed.
          </p>
          <TextInput
            id="pair-name"
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
            <Button variant="ghost" size="sm" onClick={finish} disabled={busy}>
              Done
            </Button>
            <Button variant="primary" size="sm" onClick={save} disabled={busy || !name.trim()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
