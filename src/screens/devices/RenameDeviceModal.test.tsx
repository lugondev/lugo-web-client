import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { RenameDeviceModal } from './RenameDeviceModal'
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

it('opens prefilled with the current name', () => {
  render(<RenameDeviceModal device={DEVICE} onCancel={() => {}} onConfirm={() => {}} />)
  expect((screen.getByLabelText('Device name') as HTMLInputElement).value).toBe('Lugo-48D0')
})

it('confirms with the edited name', () => {
  const onConfirm = vi.fn()
  render(<RenameDeviceModal device={DEVICE} onCancel={() => {}} onConfirm={onConfirm} />)

  fireEvent.change(screen.getByLabelText('Device name'), {
    target: { value: 'Kitchen speaker' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

  expect(onConfirm).toHaveBeenCalledWith('Kitchen speaker')
})

it('refuses to save a blank name', () => {
  render(<RenameDeviceModal device={DEVICE} onCancel={() => {}} onConfirm={() => {}} />)
  fireEvent.change(screen.getByLabelText('Device name'), { target: { value: '   ' } })
  expect((screen.getByRole('button', { name: 'Rename' }) as HTMLButtonElement).disabled).toBe(true)
})

it('shows the server error without closing', () => {
  render(
    <RenameDeviceModal
      device={DEVICE}
      error="device 'd1' not found"
      onCancel={() => {}}
      onConfirm={() => {}}
    />,
  )
  expect(screen.getByRole('alert').textContent).toContain('not found')
})

it('renders nothing when no device is selected', () => {
  render(<RenameDeviceModal device={null} onCancel={() => {}} onConfirm={() => {}} />)
  expect(screen.queryByLabelText('Device name')).toBeNull()
})
