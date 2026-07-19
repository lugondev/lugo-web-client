import { useEffect, useRef, useState } from 'react'
import { listSessions } from '../api/history'
import { listProfiles, type Profile } from '../api/profiles'
import { checkAudioSupport } from '../audio/capability'
import { Conversation, type TalkState } from '../audio/conversation'
import { LugoMark } from '../components/LugoMark'
import { Button } from '../ui/Button'
import { PROFILE_KEY, resolveInitialProfile } from './talkProfile'
import { controlFor } from './talkControl'
import { latestSessionId } from './talkSession'
import './Talk.css'

const STATE_LABEL: Record<TalkState, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  error: 'Error',
}

export function Talk({
  resumeSessionId = null,
  onResumed,
}: { resumeSessionId?: string | null; onResumed?: () => void } = {}) {
  const [state, setState] = useState<TalkState>('idle')
  const [reply, setReply] = useState('')
  const [you, setYou] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState(0)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profile, setProfile] = useState<string>('')
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

  useEffect(() => {
    let alive = true
    listProfiles()
      .then((list) => {
        if (!alive) return
        setProfiles(list)
        setProfile(resolveInitialProfile(localStorage.getItem(PROFILE_KEY), list.map((p) => p.name)))
      })
      .catch(() => { /* danh sách hỏng thì cứ để trống -> Start chạy bằng default server */ })
    return () => { alive = false }
  }, [])

  // Đến từ History (Continue) -> tự kết nối luôn, không chờ bấm Start talking
  // lần nữa. resumeSessionId chỉ tiêu thụ một lần: onResumed() báo cho App
  // xoá nó đi, nên quay lại Talk sau đó không tự resume lại phiên cũ.
  useEffect(() => {
    if (!resumeSessionId) return
    void start(resumeSessionId).then(() => onResumed?.())
  }, [resumeSessionId])

  function chooseProfile(name: string): void {
    setProfile(name)
    localStorage.setItem(PROFILE_KEY, name)
  }

  async function start(explicitSessionId?: string) {
    const support = checkAudioSupport()
    if (!support.ok) {
      // Nói thật thiếu gì, và nói cách sửa. Không "trình duyệt không hỗ trợ".
      setError(`This browser is missing ${support.missing.join(', ')}. Open it in a recent Chrome or Edge, over HTTPS.`)
      setState('error')
      return
    }
    setError(null)
    setReply('')
    setYou('')
    // Có id chỉ định (đến từ History/Continue) -> dùng thẳng, không tra cứu.
    // Không thì lấy phiên gần nhất; tra cứu lỗi không được chặn Start talking.
    let sessionId = explicitSessionId
    if (!sessionId) {
      try {
        sessionId = latestSessionId(await listSessions(1))
      } catch {
        // bỏ qua -- cứ bắt đầu phiên mới như trước khi có tính năng này
      }
    }
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
    }, profile || undefined, sessionId)
    convRef.current = conv
    await conv.connect()
  }

  function stop() {
    convRef.current?.disconnect()
    convRef.current = null
    setState('idle')
  }

  function skip() {
    convRef.current?.abort()
  }

  const live = state !== 'idle' && state !== 'error'
  const control = controlFor(state)

  return (
    <main className="talk" data-surface="talk">
      <div className="talk__bar">
        <span className="talk__wordmark">LUGO</span>
        {profiles.length > 0 && (
          <label className="talk__profile">
            <span className="sr-only">Assistant</span>
            <select
              aria-label="Assistant"
              value={profile}
              disabled={live}
              onChange={(e) => chooseProfile(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.name} value={p.name}>{p.nickname || p.name}</option>
              ))}
            </select>
          </label>
        )}
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
          <p className="talk__hint">Just talk. Cut in any time to interrupt.</p>
        ) : (
          <p className="talk__hint">Tap to start. Talk like you would with a friend.</p>
        )}

        {you && !error && <p className="talk__you">{you}</p>}
      </div>

      <div className="talk__controls">
        {control.kind === 'start' ? (
          <Button variant="primary" onClick={() => void start()}>
            {control.label}
          </Button>
        ) : (
          <Button variant="secondary" onClick={control.kind === 'skip' ? skip : stop}>
            {control.label}
          </Button>
        )}
      </div>
    </main>
  )
}
