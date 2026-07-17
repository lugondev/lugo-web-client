import { readLevel, smoothLevel } from './level'
import { PCM_WORKLET_SRC } from './pcm-worklet'

const SAMPLE_RATE = 16000

export function floatToPcm16(input: Float32Array): ArrayBuffer {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i += 1) {
    // Cắt ngưỡng TRƯỚC khi nhân: bỏ qua bước này thì giá trị ngoài [-1,1] quấn
    // vòng và đỉnh sóng thành tiếng nổ lách tách.
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out.buffer
}

export class Mic {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private analyser: AnalyserNode | null = null
  private buf = new Float32Array(1024)
  private _level = 0

  async start(onFrame: (pcm: ArrayBuffer) => void): Promise<void> {
    // Xin AudioContext đúng 16kHz để trình duyệt tự resample -- rẻ hơn và
    // đúng hơn là ta tự viết resampler.
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })

    const blob = new Blob([PCM_WORKLET_SRC], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    try {
      await this.ctx.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }

    const source = this.ctx.createMediaStreamSource(this.stream)
    const node = new AudioWorkletNode(this.ctx, 'pcm-capture')
    node.port.onmessage = (e) => onFrame(floatToPcm16(e.data as Float32Array))
    source.connect(node)
    // Worklet phải nối tới destination mới chạy, nhưng ta KHÔNG muốn nghe lại
    // tiếng mình -- nối qua một gain 0.
    const mute = this.ctx.createGain()
    mute.gain.value = 0
    node.connect(mute)
    mute.connect(this.ctx.destination)

    // Analyser song song với worklet (KHÔNG nối tiếp) -- worklet vẫn phải
    // nhận nguyên tín hiệu để STT không bị suy giảm.
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    source.connect(this.analyser)
  }

  /** Mức giọng NÓI CỦA BẠN, 0..1. Chấm trong logo là "bạn" -- nó nở theo cái này. */
  get level(): number {
    this._level = smoothLevel(this._level, readLevel(this.analyser, this.buf), 0.5, 0.12)
    return this._level
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    void this.ctx?.close()
    this.ctx = null
    this.analyser = null
    this._level = 0
  }
}
