import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../../api/devices', async (orig) => ({
  ...(await orig<typeof import('../../api/devices')>()),
  claimDevice: vi.fn(),
}))

import { claimDevice } from '../../api/devices'
import { PairWizard } from './PairWizard'

// The server's pairing code (api_gateway app/services/auth/pairing.py,
// `_CODE_DIGITS`) was widened 6 -> 8 as brute-force hardening. The screen this
// wizard replaced had the old 6 hardcoded in three places, which made pairing
// impossible: the input truncated the last two digits and the submit button
// never enabled. These tests pin the wizard to the server's real code length.
const CODE = '01234567'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(claimDevice).mockResolvedValue({} as never)
})

/** Open the wizard and walk to the code step, filling in `code` and a name. */
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
  fireEvent.change(screen.getByLabelText('Device name'), { target: { value: 'Kitchen' } })
  return screen.getByRole('button', { name: 'Pair device' }) as HTMLButtonElement
}

it('accepts a full-length code and submits it verbatim, bound to the assistant', async () => {
  const submit = await renderAndFill(CODE)
  expect((screen.getByLabelText(/digit code/i) as HTMLInputElement).value).toBe(CODE)
  expect(submit.disabled).toBe(false)

  fireEvent.click(submit)
  // The assistant rides along with the claim: no window where the device is
  // paired but answers to nothing.
  await waitFor(() => expect(claimDevice).toHaveBeenCalledWith(CODE, 'Kitchen', 'kitchen'))
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

it('confirms with the assistant name and reassures that moving is free', async () => {
  const submit = await renderAndFill(CODE)
  fireEvent.click(submit)
  const done = await screen.findByRole('heading', { name: 'Device added' })
  expect(done).toBeTruthy()
  expect(screen.getByText(/no re-pairing needed/i)).toBeTruthy()
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
