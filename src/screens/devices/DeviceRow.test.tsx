import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { DeviceRow } from './DeviceRow'
import type { Device } from '../../api/devices'

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

it('offers rename alongside move and remove', () => {
  const onRename = vi.fn()
  render(
    <DeviceRow device={DEVICE} onMove={() => {}} onRemove={() => {}} onRename={onRename} />,
  )

  fireEvent.click(screen.getByRole('button', { name: /More actions/i }))
  fireEvent.click(screen.getByText('Rename device'))

  expect(onRename).toHaveBeenCalled()
})
