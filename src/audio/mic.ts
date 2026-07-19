import { readLevel, smoothLevel } from './level'
import { PCM_WORKLET_SRC } from './pcm-worklet'

const SAMPLE_RATE = 16000
// Batch mic into ~32ms packets (512 samples = exactly 4 of AudioWorklet's
// 128-sample render quanta) before sending over WS -- see createMicBatcher.
// 32ms is still fast enough for realtime STT, adding at most 32ms of latency
// versus sending immediately.
const MIC_BATCH_SAMPLES = 512

export function floatToPcm16(input: Float32Array): ArrayBuffer {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i += 1) {
    // Clamp BEFORE scaling: skip this and values outside [-1,1] wrap around,
    // turning waveform peaks into crackling pops.
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out.buffer
}

/** Batch chunks from the AudioWorklet (a fixed 128 samples each, ~8ms at 16kHz)
 * before calling onFrame, instead of hitting the WS every 8ms (~125 packets/sec,
 * 256 bytes/packet -- looks like "spam" in the Network tab and wastes framing
 * overhead). Returns a push(chunk) function; once accumulated samples reach
 * targetSamples it merges them, converts to PCM16, calls onFrame once, then
 * resets to empty. */
export function createMicBatcher(
  targetSamples: number,
  onFrame: (pcm: ArrayBuffer) => void,
): (chunk: Float32Array) => void {
  let pending: Float32Array[] = []
  let count = 0
  return (chunk: Float32Array) => {
    pending.push(chunk)
    count += chunk.length
    if (count < targetSamples) return
    const merged = new Float32Array(count)
    let offset = 0
    for (const c of pending) {
      merged.set(c, offset)
      offset += c.length
    }
    pending = []
    count = 0
    onFrame(floatToPcm16(merged))
  }
}

export class Mic {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private analyser: AnalyserNode | null = null
  private buf = new Float32Array(1024)
  private _level = 0

  async start(onFrame: (pcm: ArrayBuffer) => void): Promise<void> {
    // Request a 16kHz AudioContext so the browser resamples for us -- cheaper
    // and more correct than writing our own resampler.
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
    const pushBatch = createMicBatcher(MIC_BATCH_SAMPLES, onFrame)
    node.port.onmessage = (e) => pushBatch(e.data as Float32Array)
    source.connect(node)
    // The worklet only runs if it's connected to the destination, but we do NOT
    // want to hear ourselves -- route through a gain of 0.
    const mute = this.ctx.createGain()
    mute.gain.value = 0
    node.connect(mute)
    mute.connect(this.ctx.destination)

    // Analyser runs in parallel with the worklet (NOT in series) -- the worklet
    // must still receive the full signal so STT quality isn't degraded.
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    source.connect(this.analyser)
  }

  /** Level of YOUR OWN voice, 0..1. The dot in the logo is "you" -- it grows with this. */
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
