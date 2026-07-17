import { useEffect, useRef, useState } from 'react'
import { checkAudioSupport } from '../audio/capability'
import { Conversation, type TalkState } from '../audio/conversation'
import { LugoMark } from '../components/LugoMark'
import './Talk.css'

const STATE_LABEL: Record<TalkState, string> = {
  idle: 'Chưa kết nối',
  connecting: 'Đang kết nối',
  listening: 'Đang nghe',
  thinking: 'Đang nghĩ',
  speaking: 'Đang trả lời',
  error: 'Có lỗi',
}

export function Talk() {
  const [state, setState] = useState<TalkState>('idle')
  const [reply, setReply] = useState('')
  const [you, setYou] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState(0)
  const convRef = useRef<Conversation | null>(null)

  // Đọc level ~mỗi khung hình. Không đưa vào state của Conversation vì đây
  // thuần túy là chuyện vẽ -- lớp audio không cần biết có ai đang vẽ.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const c = convRef.current
      if (c) setLevel(c.level)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => () => convRef.current?.disconnect(), [])

  async function start() {
    const support = checkAudioSupport()
    if (!support.ok) {
      // Nói thật thiếu gì, và nói cách sửa. Không "trình duyệt không hỗ trợ".
      setError(`Trình duyệt này thiếu ${support.missing.join(', ')}. Hãy mở bằng Chrome hoặc Edge bản mới, qua HTTPS.`)
      setState('error')
      return
    }
    setError(null)
    setReply('')
    setYou('')
    const conv = new Conversation({
      onState: (s) => {
        setState(s)
        // Lượt mới bắt đầu -> xoá lượt cũ. Không làm thế thì các lượt dính
        // vào nhau thành một khối chữ dài vô tận.
        if (s === 'thinking') setReply('')
      },
      onUserText: setYou,
      onReplyText: (t) => setReply((prev) => (prev ? `${prev} ${t}` : t)),
      onError: (m) => setError(m),
    })
    convRef.current = conv
    await conv.connect()
  }

  function stop() {
    convRef.current?.disconnect()
    convRef.current = null
    setState('idle')
  }

  const live = state !== 'idle' && state !== 'error'

  return (
    <main className="talk" data-surface="talk">
      <div className="talk__bar">
        <span className="talk__wordmark">LUGO</span>
      </div>

      <div className="talk__stage">
        <LugoMark state={state} level={level} />

        {/* Vòng tròn đã nói trạng thái cho người nhìn thấy nó. Dòng này dành
            cho người dùng trình đọc màn hình -- khác đối tượng, không trùng việc. */}
        <p className="sr-only" aria-live="polite">
          {STATE_LABEL[state]}
        </p>

        {error ? (
          <p className="talk__error" role="alert">{error}</p>
        ) : reply ? (
          <p className="talk__reply">{reply}</p>
        ) : live ? (
          <p className="talk__hint">Cứ nói tự nhiên. Muốn ngắt lời thì cứ nói chen vào.</p>
        ) : (
          <p className="talk__hint">Nhấn để bắt đầu. Cứ nói như nói với một người bạn.</p>
        )}

        {you && !error && <p className="talk__you">{you}</p>}
      </div>

      <div className="talk__controls">
        {live ? (
          <button className="talk__btn" onClick={stop}>
            Dừng
          </button>
        ) : (
          <button className="talk__btn talk__btn--primary" onClick={start}>
            Bắt đầu nói
          </button>
        )}
      </div>
    </main>
  )
}
