import { useState } from 'react'
import { PAIR_CODE_LENGTH, claimDevice, friendlyDeviceError } from '../../api/devices'
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
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function close() {
    setStep('intro')
    setCode('')
    setName('')
    setError(null)
    onCancel()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await claimDevice(code.trim(), name.trim(), profileId)
      setStep('done')
    } catch (err) {
      // Keep the server's DISTINCTION between "wrong code" and "hardware already
      // paired": they call for two different actions from the user.
      setError(err instanceof Error ? friendlyDeviceError(err.message) : 'Pairing failed')
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
          <TextInput
            id="pair-name"
            label="Device name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name it, e.g. Kitchen speaker"
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
              disabled={busy || code.length !== PAIR_CODE_LENGTH || !name.trim()}
            >
              {busy ? 'Pairing…' : 'Pair device'}
            </Button>
          </div>
        </form>
      )}

      {step === 'done' && (
        <>
          <p className="modal__body">
            <strong>{name}</strong> now runs {profileTitle}. Change that any time from this
            assistant&apos;s device list — no re-pairing needed.
          </p>
          <div className="modal__actions">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setStep('intro')
                setCode('')
                setName('')
                onPaired()
              }}
            >
              Done
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
