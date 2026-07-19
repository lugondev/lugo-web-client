import { readLevel, smoothLevel } from './level'

const OUTPUT_SAMPLE_RATE = 24000

/** When to play the next chunk on the AudioContext clock.
 *
 * The server sends a whole burst of packets at once (conversation_opus_pace=False),
 * so we must NOT play each on arrival -- they'd overlap. Queue them tail-to-tail
 * via the cursor. If the cursor has fallen behind the present (tab asleep, machine
 * lagging), catch up to now: scheduling into the past makes Web Audio play
 * everything at once as noise. */
export function nextStartTime(now: number, cursor: number): number {
  return Math.max(now, cursor)
}

/** Actual duration of a decoded chunk, in seconds.
 *
 * You MUST take the rate from the AudioData itself: WebCodecs IGNORES the
 * sampleRate we pass to configure() and always outputs 48kHz (Opus decodes
 * internally at 48k) -- measured on Chromium 149: 2880 frames/packet at 60ms.
 * Trusting the constant 24000 here makes audio play at half speed and the cursor
 * drift.
 */
export function chunkDuration(frames: number, sampleRate: number): number {
  return frames / sampleRate
}

export class Player {
  private ctx: AudioContext | null = null
  private decoder: AudioDecoder | null = null
  private cursor = 0
  private sources: AudioBufferSourceNode[] = []
  private timestamp = 0
  private analyser: AnalyserNode | null = null
  private buf = new Float32Array(1024)
  private _level = 0

  private ensure(): void {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.connect(this.ctx.destination)
    this.decoder = new AudioDecoder({
      output: (data: AudioData) => this.schedule(data),
      error: (e: Error) => console.error('opus decode', e),
    })
    this.decoder.configure({
      codec: 'opus',
      sampleRate: OUTPUT_SAMPLE_RATE,
      numberOfChannels: 1,
    })
  }

  private schedule(data: AudioData): void {
    const ctx = this.ctx
    if (!ctx) {
      data.close()
      return
    }
    const frames = data.numberOfFrames
    // The REAL rate of the decoded data, NOT the configured OUTPUT_SAMPLE_RATE.
    // WebCodecs ignores the sampleRate passed to configure() and always outputs
    // 48kHz for Opus (measured on Chromium 149: 2880 frames/packet at 60ms means
    // 48000Hz, not 24000Hz). Assuming 24000 here would tag the buffer with the
    // wrong rate and drift the cursor -> half-speed playback, garbled audio.
    const sampleRate = data.sampleRate
    const pcm = new Float32Array(frames)
    data.copyTo(pcm, { planeIndex: 0, format: 'f32-planar' })
    data.close()

    const buf = ctx.createBuffer(1, frames, sampleRate)
    buf.copyToChannel(pcm, 0)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.analyser ?? ctx.destination)

    const at = nextStartTime(ctx.currentTime, this.cursor)
    src.start(at)
    this.cursor = at + chunkDuration(frames, sampleRate)
    this.sources.push(src)
    src.onended = () => {
      this.sources = this.sources.filter((s) => s !== src)
    }
  }

  push(packet: ArrayBuffer): void {
    this.ensure()
    // 60ms frame @ 24kHz. timestamp is in microseconds.
    const chunk = new EncodedAudioChunk({
      type: 'key', // Opus: every frame is independent
      timestamp: this.timestamp,
      data: packet,
    })
    this.timestamp += 60_000
    this.decoder?.decode(chunk)
  }

  get playing(): boolean {
    return this.sources.length > 0
  }

  /** Level of LUGO's SPEECH, 0..1. The circle breathes with this. */
  get level(): number {
    this._level = smoothLevel(this._level, readLevel(this.analyser, this.buf), 0.4, 0.1)
    return this._level
  }

  /** Barge-in: go silent NOW. The user has talked over us -- keeping playing is wrong. */
  stop(): void {
    this.sources.forEach((s) => {
      try {
        s.stop()
      } catch {
        // already stopped
      }
    })
    this.sources = []
    this.cursor = 0
    this.timestamp = 0
    try {
      this.decoder?.close()
    } catch {
      // not configured yet
    }
    this.decoder = null
    void this.ctx?.close()
    this.ctx = null
    this.analyser = null
    this._level = 0
  }
}
