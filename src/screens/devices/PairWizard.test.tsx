import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../../api/devices', async (orig) => ({
  ...(await orig<typeof import('../../api/devices')>()),
  claimDevice: vi.fn(),
  renameDevice: vi.fn(),
}))

import { claimDevice, renameDevice } from '../../api/devices'
import { PairWizard } from './PairWizard'

// The server's pairing code (api_gateway app/services/auth/pairing.py,
// `_CODE_DIGITS`) was widened 6 -> 8 as brute-force hardening. The screen this
// wizard replaced had the old 6 hardcoded in three places, which made pairing
// impossible: the input truncated the last two digits and the submit button
// never enabled. These tests pin the wizard to the server's real code length.
const CODE = '01234567'

const PAIRED = {
  id: 'd1',
  user_id: 'u1',
  name: 'Lugo-48D0',
  serial: '2884855048d0',
  profile_id: 'kitchen',
  created_at: null,
  last_seen_at: null,
  revoked: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(claimDevice).mockResolvedValue(PAIRED as never)
  vi.mocked(renameDevice).mockResolvedValue(undefined as never)
})

/** Open the wizard and walk to the code step, filling in `code`. */
async function renderAndFill(code: string) {
  render(
    <PairWizard
      open
      profileId="kitchen"
      profileTitle="Kitchen assistant"
      onCancel={() => {}}
      onPaired={() => {}}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'I see a code' }))
  fireEvent.change(screen.getByLabelText(/digit code/i), { target: { value: code } })
  return screen.getByRole('button', { name: 'Pair device' }) as HTMLButtonElement
}

it('pairs on the code alone -- no name is asked for up front', async () => {
  const submit = await renderAndFill(CODE)
  expect(screen.queryByLabelText('Device name')).toBeNull()
  expect(submit.disabled).toBe(false)

  fireEvent.click(submit)
  // The assistant rides along with the claim: no window where the device is
  // paired but answers to nothing. The name is the server's job now.
  await waitFor(() => expect(claimDevice).toHaveBeenCalledWith(CODE, '', 'kitchen'))
})

it('keeps submit disabled for a short code', async () => {
  const submit = await renderAndFill(CODE.slice(0, -1))
  expect(submit.disabled).toBe(true)
})

it('strips non-digits and caps at the code length', async () => {
  await renderAndFill('12a34-5678999')
  expect((screen.getByLabelText(/digit code/i) as HTMLInputElement).value).toBe('12345678')
})

it('does not ask which assistant -- that is fixed by where it was opened from', async () => {
  await renderAndFill(CODE)
  expect(screen.queryByLabelText('Assistant')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Pair with Kitchen assistant' })).toBeTruthy()
})

it('offers the server-chosen name, prefilled and editable', async () => {
  const submit = await renderAndFill(CODE)
  fireEvent.click(submit)
  await screen.findByRole('heading', { name: 'Device added' })
  expect((screen.getByLabelText('Device name') as HTMLInputElement).value).toBe('Lugo-48D0')
})

it('saves an edited name against the device that was just paired', async () => {
  const submit = await renderAndFill(CODE)
  fireEvent.click(submit)
  await screen.findByRole('heading', { name: 'Device added' })

  fireEvent.change(screen.getByLabelText('Device name'), {
    target: { value: 'Kitchen speaker' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(renameDevice).toHaveBeenCalledWith('d1', 'Kitchen speaker'))
})

it('does not call rename when the name was left alone', async () => {
  const submit = await renderAndFill(CODE)
  fireEvent.click(submit)
  await screen.findByRole('heading', { name: 'Device added' })

  fireEvent.click(screen.getByRole('button', { name: 'Done' }))

  expect(renameDevice).not.toHaveBeenCalled()
})

it('does not call rename via Save when the name field was never edited', async () => {
  // Done never calls renameDevice at all, so it can't tell us whether the
  // guard inside save() itself is doing anything. Save is the button that
  // actually has to skip the request for an untouched field.
  const submit = await renderAndFill(CODE)
  fireEvent.click(submit)
  await screen.findByRole('heading', { name: 'Device added' })

  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(renameDevice).not.toHaveBeenCalled())
})

it('keeps the device when the rename fails -- pairing already succeeded', async () => {
  vi.mocked(renameDevice).mockRejectedValue(new Error("device 'd1' not found"))
  const submit = await renderAndFill(CODE)
  fireEvent.click(submit)
  await screen.findByRole('heading', { name: 'Device added' })

  fireEvent.change(screen.getByLabelText('Device name'), { target: { value: 'Kitchen' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(/not found/i)).toBeTruthy()
  // Still on the done step, so Done remains a clean exit.
  expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
})

it('shows an actionable message when the code is wrong or expired', async () => {
  vi.mocked(claimDevice).mockRejectedValue(new Error('pairing code is invalid or expired'))
  const submit = await renderAndFill(CODE)
  fireEvent.click(submit)
  // friendlyDeviceError's wording -- the raw server string is not shown, but the
  // DISTINCTION from "already paired" is kept, because the fixes differ.
  expect(await screen.findByText(/wrong or expired/i)).toBeTruthy()
})

it('tells the user to remove the old pairing when the hardware is already paired', async () => {
  vi.mocked(claimDevice).mockRejectedValue(new Error('device already paired to another account'))
  const submit = await renderAndFill(CODE)
  fireEvent.click(submit)
  expect(await screen.findByText(/already paired to an account/i)).toBeTruthy()
})

it('ignores dismissal while a claim is in flight -- no closing mid-request', async () => {
  // Cancel/Done are disabled while busy, but Escape and the backdrop click go
  // through the same onClose regardless of `busy`. Drive the same path they
  // use: the Modal's own keydown listener on `document`. If dismissal is not
  // blocked, close() fires here -- resetting state and calling onCancel --
  // while the claim promise is still pending.
  let resolveClaim!: (device: typeof PAIRED) => void
  vi.mocked(claimDevice).mockReturnValue(
    new Promise((resolve) => {
      resolveClaim = resolve
    }) as never,
  )
  const onCancel = vi.fn()
  const onPaired = vi.fn()
  render(
    <PairWizard
      open
      profileId="kitchen"
      profileTitle="Kitchen assistant"
      onCancel={onCancel}
      onPaired={onPaired}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'I see a code' }))
  fireEvent.change(screen.getByLabelText(/digit code/i), { target: { value: CODE } })
  fireEvent.click(screen.getByRole('button', { name: 'Pair device' }))

  // The claim is in flight (busy) -- Escape must be a no-op here, not an early
  // close that fires onCancel while the request is still running.
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onCancel).not.toHaveBeenCalled()

  resolveClaim(PAIRED)
  // The dismissal was blocked rather than silently discarding the in-flight
  // claim, so pairing still lands normally once it resolves -- state was
  // never corrupted by a close() that ran mid-request.
  await screen.findByRole('heading', { name: 'Device added' })
  expect(onPaired).not.toHaveBeenCalled()
})
