import { ApiUrl } from '../api/client'
import { getAccessToken } from '../api/tokens'
import { Mic } from './mic'
import { Player } from './player'

export type TalkState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

export function wsUrl(base: string, path: string): string {
  return `${base.replace(/^http/, 'ws')}${path}`
}

export function buildParams(profile?: string, sessionId?: string): URLSearchParams {
  const p = new URLSearchParams({
    // Opus over the already-authenticated socket: audio_out=url would point
    // at /artifacts, which has NO auth -- anyone with the URL could listen in.
    audio_out: 'opus',
    output: 'audio,text',
    sample_rate: '16000',
    output_sample_rate: '24000',
    // Disable the server's ~300ms real-time pacer (sized for ESP32/RPi ring
    // buffers). AudioContext can hold seconds of scheduled audio, so letting
    // packets arrive as fast as they're synthesized -- instead of drip-fed to
    // match playback speed -- gives the browser a much bigger natural jitter
    // cushion. See docs/superpowers/specs/2026-07-28-web-audio-jitter-buffer-design.md.
    opus_pace: '0',
  })
  if (profile) p.set('profile', profile)
  if (sessionId) p.set('session_id', sessionId)
  return p
}

export interface ConversationCallbacks {
  onState?: (s: TalkState) => void
  onUserText?: (text: string) => void
  onReplyText?: (text: string) => void
  onError?: (message: string) => void
}

export class Conversation {
  private ws: WebSocket | null = null
  private mic = new Mic()
  private player = new Player()
  private state: TalkState = 'idle'
  private cb: ConversationCallbacks
  private profile?: string
  private sessionId?: string
  // Set when WE initiate the close (disconnect). Closing a still-CONNECTING
  // socket makes the browser fire onerror -- but a teardown we asked for is not
  // a connection failure, so we must not report it. React StrictMode tears down
  // the first resume connection this way on every mount.
  private closing = false
  // Auto-interrupt (barge-in): true -> your voice cuts Lugo off mid-turn the
  // moment it's heard (the original behavior). false -> Lugo finishes its turn
  // no matter what the mic picks up; only the Skip button ends it. This matters
  // in noisy rooms, where stray sound would otherwise chop every reply short.
  private autoInterrupt: boolean

  constructor(cb: ConversationCallbacks = {}, profile?: string, sessionId?: string, autoInterrupt = true) {
    this.cb = cb
    this.profile = profile
    this.sessionId = sessionId
    this.autoInterrupt = autoInterrupt
  }

  /** Flip interrupt mode on a live call -- the toggle in the UI takes effect
   * without dropping the connection. */
  setAutoInterrupt(on: boolean): void {
    this.autoInterrupt = on
  }

  /** Level for drawing the circle: when Lugo is speaking, follow its audio;
   * otherwise follow your voice. Honors the "whoever is active drives it" rule. */
  get level(): number {
    return this.state === 'speaking' ? this.player.level : this.mic.level
  }

  private setState(s: TalkState): void {
    if (this.state === s) return
    this.state = s
    this.cb.onState?.(s)
  }

  async connect(): Promise<void> {
    this.setState('connecting')
    const token = getAccessToken()
    if (!token) {
      this.setState('error')
      this.cb.onError?.('not signed in')
      return
    }

    // Token goes through the subprotocol, NOT the query string: query strings
    // get written to access logs and proxy history.
    this.ws = new WebSocket(wsUrl(ApiUrl(''), `/v1/conversation/stream?${buildParams(this.profile, this.sessionId)}`), [
      'bearer',
      token,
    ])
    this.ws.binaryType = 'arraybuffer'

    this.ws.onmessage = (e) => this.onMessage(e)
    this.ws.onerror = () => {
      // A close WE asked for (disconnect) surfaces here when the socket was
      // still connecting -- that's not a failure the user needs to see.
      if (this.closing) return
      this.setState('error')
      this.cb.onError?.('connection lost')
    }
    this.ws.onclose = () => {
      this.mic.stop()
      this.player.stop()
      if (this.state !== 'error') this.setState('idle')
    }
    this.ws.onopen = async () => {
      await this.mic.start((pcm) => {
        // Half-duplex: don't send mic while the assistant is speaking. The
        // speaker plays the assistant's voice, the mic picks it back up (echo)
        // -> the server's endpointer thinks the user is barging in -> aborts
        // mid-turn, cutting the audio off after a short burst. Block it at the
        // source. Trade-off: no voice barge-in while the assistant speaks
        // (wait until it finishes).
        if (this.state === 'speaking' || this.player.playing) return
        // Manual-skip mode: the whole point is that Lugo is NOT interrupted by
        // sound. The server's endpointer would still abort the turn if it heard
        // mic audio while thinking, so withhold the mic for the entire turn --
        // only the Skip button ends it early.
        if (!this.autoInterrupt && this.state === 'thinking') return
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(pcm)
      })
      this.setState('listening')
    }
  }

  private onMessage(e: MessageEvent): void {
    if (e.data instanceof ArrayBuffer) {
      this.player.push(e.data)
      return
    }
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(e.data as string)
    } catch {
      return
    }
    switch (msg.event) {
      case 'speech_start':
        // Manual-skip mode: the user has asked Lugo to keep talking until they
        // hit Skip, so a stray noise (or their own "mm-hm") must NOT kill the
        // turn. Ignore the endpointer entirely while a turn is in flight.
        if (!this.autoInterrupt && this.player.playing) break
        // Barge-in: the user talks over the assistant -> go quiet immediately
        // and tell the server to drop the running turn. Without this, the two
        // voices overlap.
        if (this.player.playing) {
          this.player.stop()
          this.send({ type: 'abort' })
        }
        this.setState('listening')
        break
      case 'speech_end':
      case 'processing':
        this.setState('thinking')
        break
      case 'user_transcript':
        this.cb.onUserText?.(String(msg.text ?? ''))
        break
      case 'response_text':
        this.cb.onReplyText?.(String(msg.text ?? ''))
        break
      case 'audio_start':
        this.setState('speaking')
        break
      case 'turn_done':
        // turn_done means the SERVER finished sending, not that we finished
        // playing. With pacing off (opus_pace=0) it sends far faster than
        // realtime, so seconds of this turn can still be scheduled ahead in the
        // AudioContext. Going 'listening' now would swap the Skip button for
        // Stop and announce "Listening" while Lugo is still audibly talking --
        // stay 'speaking' until the audio actually drains.
        if (this.player.playing) this.player.onDrained(() => this.setState('listening'))
        else this.setState('listening')
        break
      case 'aborted':
        // Nothing to wait for: every path that asks the server to abort
        // (abort(), and the speech_start barge-in above) calls player.stop()
        // first, so the tail is already gone by the time this arrives.
        this.setState('listening')
        break
      case 'error':
        this.setState('error')
        this.cb.onError?.(String(msg.message ?? 'unknown error'))
        break
    }
  }

  private send(obj: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj))
  }

  sendText(text: string): void {
    this.send({ type: 'text', text })
    this.setState('thinking')
  }

  abort(): void {
    this.player.stop()
    this.send({ type: 'abort' })
    this.setState('listening')
  }

  /** End this conversation and start a fresh one, without dropping the socket.
   *
   * Stops playback first: the reply still draining belongs to the conversation
   * being left behind, and letting it finish over the top of "starting fresh"
   * reads as the assistant ignoring the request. `abort` before `new_session`
   * for the same reason on the server side: the gateway lets a turn in flight
   * FINISH before rotating (a device asks for a new session from mid-turn and
   * has to be allowed to say so), which for a button press would mean the old
   * answer still streaming in. Pressing the button means now.
   *
   * The server answers `session_rotated`; nothing here needs the new id, since
   * this client keeps no session state of its own between turns. */
  newConversation(): void {
    this.player.stop()
    this.send({ type: 'abort' })
    this.send({ type: 'new_session' })
    this.setState('listening')
  }

  disconnect(): void {
    this.closing = true
    this.mic.stop()
    this.player.stop()
    this.ws?.close()
    this.ws = null
    this.setState('idle')
  }
}
