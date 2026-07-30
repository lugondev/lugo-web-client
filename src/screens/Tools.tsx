import { useEffect, useRef, useState } from 'react'
import { synthesize, transcribeFile } from '../api/tools'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { TextArea } from '../ui/TextArea'
import './Tools.css'

function ToText() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    if (!file) return
    setBusy(true)
    setError(null)
    setText('')
    try {
      const t = await transcribeFile(file)
      setText(t || '(nothing heard)')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not transcribe')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="tool__section">
      <h2 className="tool__card-h">Recording to text</h2>
      <p className="tool__hint">Pick a wav or mp3 file. Lugo will listen and type it out.</p>
      <input
        className="tool__file"
        type="file"
        accept="audio/*"
        aria-label="Choose a recording"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null)
          setText('')
          setError(null)
        }}
      />
      {error && (
        <p className="tool__err" role="alert">
          {error}
        </p>
      )}
      {text && <p className="tool__out">{text}</p>}
      <div className="tool__actions">
        <Button variant="primary" onClick={run} disabled={!file || busy}>
          {busy ? 'Listening…' : 'To text'}
        </Button>
      </div>
    </Card>
  )
}

function ToVoice() {
  const [input, setInput] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function run() {
    setBusy(true)
    setError(null)
    if (url) URL.revokeObjectURL(url)
    setUrl(null)
    try {
      const r = await synthesize(input.trim())
      if (!mounted.current) {
        // The component went away while the request was in flight: no state
        // update can capture this URL for later cleanup, so revoke it now.
        URL.revokeObjectURL(r.audioUrl)
        return
      }
      setUrl(r.audioUrl)
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Could not read this out')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])

  return (
    <Card className="tool__section">
      <h2 className="tool__card-h">Text to speech</h2>
      <p className="tool__hint">Type something and Lugo will read it aloud.</p>
      <TextArea
        id="tool-tts-text"
        label="Text to read"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Lovely day today…"
      />
      {error && (
        <p className="tool__err" role="alert">
          {error}
        </p>
      )}
      {url && (
        // Local blob URL created by synthesize() from the raw audio bytes.
        // It lives only in this tab's memory and is revoked once replaced or on unmount.
        <audio className="tool__audio" controls src={url} autoPlay />
      )}
      <div className="tool__actions">
        <Button variant="primary" onClick={run} disabled={!input.trim() || busy}>
          {busy ? 'Reading…' : 'Read aloud'}
        </Button>
      </div>
    </Card>
  )
}

export function Tools({ onBack }: { onBack?: () => void }) {
  return (
    <main className="page">
      {/* Tools is no longer a top-level nav destination -- it hangs off Settings,
          so it has to offer its own way back. Optional so the screen still
          renders standalone in tests. */}
      {onBack && (
        <div className="page__back">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ‹ Settings
          </Button>
        </div>
      )}
      <div className="page__head">
        <h1 className="page__title">Tools</h1>
      </div>
      <p className="page__sub">Two quick jobs, no need to open a conversation.</p>
      <ToText />
      <ToVoice />
    </main>
  )
}
