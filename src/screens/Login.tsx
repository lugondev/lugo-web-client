import { useState, type FormEvent } from 'react'
import { login } from '../api/auth'
import { LugoMark } from '../components/LugoMark'
import { Button } from '../ui/Button'
import { TextInput } from '../ui/TextInput'
import './Login.css'

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
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit} className="login__form">
        <div className="login__mark">
          {/* The mark idles here the same way it idles on Talk: the first thing
              the app shows is the thing that will be listening to you. */}
          <div className="login__lockup">
            <LugoMark state="idle" level={0} />
            <h1 className="login__title">LUGO</h1>
          </div>
          <p className="login__tag">Sign in to reach your assistants and their devices.</p>
        </div>
        {/* No placeholders that repeat the label: two identical words stacked on
            top of each other is noise, and the placeholder vanishes on typing
            while the label has to stay. */}
        <TextInput
          id="login-username"
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <TextInput
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p role="alert" className="login__error">{error}</p>}
        <Button variant="primary" size="lg" type="submit" fullWidth disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  )
}
