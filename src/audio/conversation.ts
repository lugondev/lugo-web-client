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

  constructor(cb: ConversationCallbacks = {}, profile?: string, sessionId?: string) {
    this.cb = cb
    this.profile = profile
    this.sessionId = sessionId
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
      this.setState('error')
      this.cb.onError?.('mất kết nối')
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
      case 'aborted':
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
  }

  disconnect(): void {
    this.mic.stop()
    this.player.stop()
    this.ws?.close()
    this.ws = null
    this.setState('idle')
  }
}
