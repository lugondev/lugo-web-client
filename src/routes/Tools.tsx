import { useState } from 'react'
import { synthesize, transcribeFile } from '../api/tools'
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
      setText(t || '(không nghe ra chữ nào)')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không nhận dạng được')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="tool__card">
      <h2 className="tool__card-h">Ghi âm thành chữ</h2>
      <p className="tool__hint">Chọn một file wav hoặc mp3. Lugo sẽ nghe và gõ lại.</p>
      <input
        className="tool__file"
        type="file"
        accept="audio/*"
        aria-label="Chọn file ghi âm"
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
      <button className="tool__btn" onClick={run} disabled={!file || busy}>
        {busy ? 'Đang nghe...' : 'Chuyển thành chữ'}
      </button>
    </section>
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
      setError(e instanceof Error ? e.message : 'Không đọc được')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="tool__card">
      <h2 className="tool__card-h">Chữ thành tiếng</h2>
      <p className="tool__hint">Gõ gì đó, Lugo sẽ đọc lên.</p>
      <textarea
        className="tool__area"
        aria-label="Đoạn chữ cần đọc"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Hôm nay trời đẹp quá..."
      />
      {error && (
        <p className="tool__err" role="alert">
          {error}
        </p>
      )}
      {url && <audio className="tool__audio" controls src={url} autoPlay />}
      <button className="tool__btn" onClick={run} disabled={!input.trim() || busy}>
        {busy ? 'Đang đọc...' : 'Đọc lên'}
      </button>
    </section>
  )
}

export function Tools() {
  return (
    <main className="tool">
      <h1 className="tool__h">Công cụ</h1>
      <p className="tool__sub">Hai việc lặt vặt, không cần mở cuộc trò chuyện.</p>
      <ToText />
      <ToVoice />
    </main>
  )
}
