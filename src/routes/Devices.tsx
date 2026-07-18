import { useEffect, useState } from 'react'
import { claimDevice, friendlyDeviceError, listDevices, revokeDevice, type Device } from '../api/devices'
import { isRecentlyActive, relativeTime } from '../lib/time'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmModal } from '../ui/ConfirmModal'
import { TextInput } from '../ui/TextInput'
import './Devices.css'

export function Devices() {
  const [items, setItems] = useState<Device[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  async function refresh() {
    try {
      setItems(await listDevices())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load devices')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function pair(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await claimDevice(code.trim(), name.trim())
      setCode('')
      setName('')
      await refresh()
    } catch (err) {
      // Server phân biệt "mã sai" với "phần cứng đã ghép rồi" -- hai lỗi đó
      // cần hai hành động khác nhau, nên GIỮ sự phân biệt.
      setError(
        err instanceof Error ? friendlyDeviceError(err.message) : 'Pairing failed',
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    setRemoving(true)
    try {
      await revokeDevice(id)
      setConfirming(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Removal failed')
    } finally {
      setRemoving(false)
    }
  }

  const active = items.filter((d) => !d.revoked)
  const confirmingDevice = active.find((d) => d.id === confirming) ?? null

  return (
    <main className="dev">
      <h1 className="dev__h">Devices</h1>
      <p className="dev__sub">Paired devices talk to Lugo using your account.</p>

      {active.length === 0 ? (
        <p className="dev__empty">
          No devices yet. Turn on your Lugo device — it&apos;ll show a 6-digit code. Enter it
          below.
        </p>
      ) : (
        <ul className="dev__list">
          {active.map((d) => (
            <li key={d.id}>
              <Card className="dev__item">
                <div>
                  <p className="dev__name">{d.name}</p>
                  <p className="dev__meta">
                    {isRecentlyActive(d.last_seen_at)
                      ? 'Active'
                      : `Last seen: ${relativeTime(d.last_seen_at)}`}
                  </p>
                  <p className="dev__serial">{d.serial}</p>
                </div>
                <Button variant="danger" size="sm" onClick={() => setConfirming(d.id)}>
                  Remove
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <form className="dev__form" onSubmit={pair}>
        <TextInput
          id="dev-code"
          label="6-digit code"
          className="dev__code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
        />
        <TextInput
          id="dev-name"
          label="Device name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name it, e.g. Kitchen speaker"
        />
        {error && (
          <p className="dev__err" role="alert">
            {error}
          </p>
        )}
        <Button variant="primary" type="submit" disabled={busy || code.length !== 6 || !name.trim()}>
          {busy ? 'Pairing…' : 'Pair device'}
        </Button>
      </form>

      <ConfirmModal
        open={confirming !== null}
        title="Remove device?"
        message={`${confirmingDevice?.name ?? 'This device'} will lose access and have to be paired again.`}
        confirmLabel="Remove"
        destructive
        busy={removing}
        onConfirm={() => confirming && remove(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </main>
  )
}
