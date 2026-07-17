import { useState, type FormEvent } from 'react'
import { login } from '../api/auth'

export function Login({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, width: 'min(320px, 100%)' }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: '0.2em' }}>LUGO</h1>
        <input
          aria-label="Tên đăng nhập"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Tên đăng nhập"
          autoComplete="username"
        />
        <input
          aria-label="Mật khẩu"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu"
          autoComplete="current-password"
        />
        {error && <p role="alert" style={{ color: 'var(--lugo-danger)', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ background: 'var(--lugo-accent-gradient)', border: 0, padding: 12, borderRadius: 8, color: '#111', fontWeight: 600 }}>
          {busy ? 'Đang vào...' : 'Vào'}
        </button>
      </form>
    </main>
  )
}
