import { useState } from 'react'
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
      <Button variant="primary" onClick={run} disabled={!file || busy}>
        {busy ? 'Listening…' : 'To text'}
      </Button>
    </Card>
  )
}

function ToVoice() {
  const [input, setInput] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    setError(null)
    setUrl(null)
    try {
      const r = await synthesize(input.trim())
      setUrl(r.audioUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this out')
    } finally {
      setBusy(false)
    }
  }

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
        // URL tuyệt đối do synthesize() trả về (API khác domain với client) --
        // KHÔNG đổi thành đường dẫn tương đối, sẽ trỏ nhầm vào domain client.
        <audio className="tool__audio" controls src={url} autoPlay />
      )}
      <Button variant="primary" onClick={run} disabled={!input.trim() || busy}>
        {busy ? 'Reading…' : 'Read aloud'}
      </Button>
    </Card>
  )
}

export function Tools() {
  return (
    <main className="tool">
      <h1 className="tool__h">Tools</h1>
      <p className="tool__sub">Two quick jobs, no need to open a conversation.</p>
      <ToText />
      <ToVoice />
    </main>
  )
}
