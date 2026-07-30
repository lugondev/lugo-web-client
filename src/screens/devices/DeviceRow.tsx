import { isRecentlyActive, relativeTime } from '../../lib/time'
import { Card } from '../../ui/Card'
import { MenuButton } from '../../ui/MenuButton'
import type { Device } from '../../api/devices'

/** One paired device, shared by the per-assistant list and the all-devices view.
 *
 * Both need the same status wording and the same actions, and two copies would
 * drift -- particularly the "Active" vs "last seen" rule, which is easy to get
 * subtly wrong (last_seen_at is a trace of the past, not live presence).
 */
export function DeviceRow({
  device,
  onMove,
  onRemove,
}: {
  device: Device
  onMove: () => void
  onRemove: () => void
}) {
  return (
    <Card className="drow">
      <div className="drow__body">
        <p className="drow__name">{device.name}</p>
        <p className="drow__status">
          {isRecentlyActive(device.last_seen_at)
            ? 'Active'
            : `Last seen: ${relativeTime(device.last_seen_at)}`}
        </p>
        <p className="drow__serial">{device.serial}</p>
      </div>
      <MenuButton
        label={`More actions for ${device.name}`}
        items={[
          { label: 'Move to another assistant', onSelect: onMove },
          // "Remove" and not "Unpair": this revokes the token, so the device has
          // to be paired again from its own screen. Unassigning (a soft change)
          // is offered inside Move, where it costs nothing.
          { label: 'Remove device', onSelect: onRemove, destructive: true },
        ]}
      />
    </Card>
  )
}
