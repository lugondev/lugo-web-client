import { ApiUrl } from '../api/client'
import { getAccessToken } from '../api/tokens'
import { Mic } from './mic'
import { Player } from './player'

export type TalkState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

export function wsUrl(base: string, path: string): string {
  return `${base.replace(/^http/, 'ws')}${path}`
}

const PARAMS = new URLSearchParams({
  // Opus qua chính socket đã xác thực: audio_out=url sẽ trỏ vào /artifacts,
  // vốn KHÔNG có auth -- ai có URL cũng nghe được hội thoại.
  audio_out: 'opus',
  output: 'audio,text',
  sample_rate: '16000',
  output_sample_rate: '24000',
})

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

  constructor(cb: ConversationCallbacks = {}) {
    this.cb = cb
  }

  /** Mức để vẽ vòng tròn: khi Lugo nói thì lấy theo tiếng nó, còn lại lấy theo
   * giọng bạn. Đúng quy tắc "ai hoạt động thì phần đó động". */
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
      this.cb.onError?.('chưa đăng nhập')
      return
    }

    // Token đi qua subprotocol, KHÔNG qua query string: query string bị ghi vào
    // access log và lịch sử proxy.
    this.ws = new WebSocket(wsUrl(ApiUrl(''), `/v1/conversation/stream?${PARAMS}`), [
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
        // Barge-in: người dùng nói đè khi trợ lý đang nói -> im ngay và bảo
        // server bỏ lượt đang chạy. Không làm thế thì hai giọng chồng nhau.
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
        this.cb.onError?.(String(msg.message ?? 'lỗi không rõ'))
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
