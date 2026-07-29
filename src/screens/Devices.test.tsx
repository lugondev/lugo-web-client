import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../api/devices', async (orig) => ({
  ...(await orig<typeof import('../api/devices')>()),
  listDevices: vi.fn(),
  claimDevice: vi.fn(),
  revokeDevice: vi.fn(),
}))

import { claimDevice, listDevices } from '../api/devices'
import { Devices } from './Devices'

// The server's pairing code (api_gateway app/services/auth/pairing.py,
// `_CODE_DIGITS`) was widened 6 -> 8 as brute-force hardening. This screen had
// the old 6 hardcoded in three places, which made pairing impossible: the input
// truncated the last two digits and the submit button never enabled. These
// tests pin the screen to the server's real code length.
const CODE = '01234567'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listDevices).mockResolvedValue([] as never)
  vi.mocked(claimDevice).mockResolvedValue({} as never)
})

async function renderAndFill(code: string) {
  render(<Devices />)
  await screen.findByRole('heading', { name: 'Devices' })
  fireEvent.change(screen.getByLabelText(/digit code/i), { target: { value: code } })
  fireEvent.change(screen.getByLabelText('Device name'), { target: { value: 'Kitchen' } })
  return screen.getByRole('button', { name: 'Pair device' }) as HTMLButtonElement
}

it('accepts a full-length code and submits it verbatim', async () => {
  const submit = await renderAndFill(CODE)
  expect((screen.getByLabelText(/digit code/i) as HTMLInputElement).value).toBe(CODE)
  expect(submit.disabled).toBe(false)

  fireEvent.click(submit)
  await waitFor(() => expect(claimDevice).toHaveBeenCalledWith(CODE, 'Kitchen'))
})

it('keeps submit disabled for a short code', async () => {
  const submit = await renderAndFill(CODE.slice(0, -1))
  expect(submit.disabled).toBe(true)
})

it('strips non-digits and caps at the code length', async () => {
  await renderAndFill('12a34-5678999')
  expect((screen.getByLabelText(/digit code/i) as HTMLInputElement).value).toBe('12345678')
})
