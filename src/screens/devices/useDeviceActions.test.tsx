import { renderHook, act, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../../api/devices', async (orig) => ({
  ...(await orig<typeof import('../../api/devices')>()),
  setDeviceProfile: vi.fn(),
  revokeDevice: vi.fn(),
}))

import { revokeDevice, setDeviceProfile, type Device } from '../../api/devices'
import { useDeviceActions } from './useDeviceActions'

const DEVICE = {
  id: 'd1',
  user_id: 'u1',
  name: 'Lugo-48D0',
  serial: '2884855048d0',
  profile_id: 'kitchen',
  created_at: null,
  last_seen_at: null,
  revoked: false,
} satisfies Device

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(setDeviceProfile).mockResolvedValue(undefined)
  vi.mocked(revokeDevice).mockResolvedValue(undefined)
})

function setup() {
  const refresh = vi.fn().mockResolvedValue(undefined)
  const onRemoveError = vi.fn()
  const hook = renderHook(() => useDeviceActions(refresh, onRemoveError))
  return { ...hook, refresh, onRemoveError }
}

it('moves the open device and refreshes', async () => {
  const { result, refresh } = setup()

  act(() => result.current.openMove(DEVICE))
  expect(result.current.moving).toEqual(DEVICE)

  await act(() => result.current.move('living-room'))

  expect(setDeviceProfile).toHaveBeenCalledWith('d1', 'living-room')
  expect(refresh).toHaveBeenCalled()
  await waitFor(() => expect(result.current.moving).toBeNull())
})

it('keeps the move dialog open and shows the error when the move fails', async () => {
  vi.mocked(setDeviceProfile).mockRejectedValue(new Error('nope'))
  const { result, refresh } = setup()

  act(() => result.current.openMove(DEVICE))
  await act(() => result.current.move('living-room'))

  expect(result.current.moveError).toBe('nope')
  // Still open, so the user can retry rather than losing their place.
  expect(result.current.moving).toEqual(DEVICE)
  expect(refresh).not.toHaveBeenCalled()
})

it('clears a stale move error when the dialog is reopened', async () => {
  vi.mocked(setDeviceProfile).mockRejectedValue(new Error('nope'))
  const { result } = setup()

  act(() => result.current.openMove(DEVICE))
  await act(() => result.current.move('living-room'))
  expect(result.current.moveError).toBe('nope')

  act(() => result.current.openMove(DEVICE))
  expect(result.current.moveError).toBeNull()
})

it('does nothing when move is called with no device open', async () => {
  const { result } = setup()
  await act(() => result.current.move('living-room'))
  expect(setDeviceProfile).not.toHaveBeenCalled()
})

it('revokes the open device and refreshes', async () => {
  const { result, refresh } = setup()

  act(() => result.current.openRemove(DEVICE))
  await act(() => result.current.remove())

  expect(revokeDevice).toHaveBeenCalledWith('d1')
  expect(refresh).toHaveBeenCalled()
  await waitFor(() => expect(result.current.removing).toBeNull())
})

it('reports removal failures to the page banner, not the dialog', async () => {
  vi.mocked(revokeDevice).mockRejectedValue(new Error('Removal failed'))
  const { result, onRemoveError } = setup()

  act(() => result.current.openRemove(DEVICE))
  await act(() => result.current.remove())

  expect(onRemoveError).toHaveBeenCalledWith('Removal failed')
})

it('clears a stale removal error at the start of the next attempt, so a later success does not leave it on screen', async () => {
  vi.mocked(revokeDevice)
    .mockRejectedValueOnce(new Error('Removal failed'))
    .mockResolvedValueOnce(undefined)
  const { result, onRemoveError, refresh } = setup()

  act(() => result.current.openRemove(DEVICE))
  await act(() => result.current.remove())
  expect(onRemoveError).toHaveBeenCalledWith('Removal failed')

  // Retry: still the same device (a failed removal leaves the dialog/target open).
  await act(() => result.current.remove())

  // Order proves the banner is cleared up front on *every* attempt, not just
  // reported on failure -- otherwise a stale message from the first try would
  // still be showing after the second try succeeds.
  expect(onRemoveError.mock.calls).toEqual([[null], ['Removal failed'], [null]])
  expect(refresh).toHaveBeenCalled()
  await waitFor(() => expect(result.current.removing).toBeNull())
})
