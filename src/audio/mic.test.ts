import { describe, expect, it, vi } from 'vitest'
import { createMicBatcher, floatToPcm16 } from './mic'

describe('floatToPcm16', () => {
  it('0 maps to 0', () => {
    const out = new Int16Array(floatToPcm16(new Float32Array([0])))
    expect(out[0]).toBe(0)
  })

  it('extremes +1 and -1 do not overflow', () => {
    const out = new Int16Array(floatToPcm16(new Float32Array([1, -1])))
    expect(out[0]).toBe(32767)
    expect(out[1]).toBe(-32768)
  })

  it('clamps values outside [-1,1] instead of letting them wrap', () => {
    // Wrapping turns waveform peaks into crackling pops -- a classic bug.
    const out = new Int16Array(floatToPcm16(new Float32Array([2, -2, 1.5])))
    expect(out[0]).toBe(32767)
    expect(out[1]).toBe(-32768)
    expect(out[2]).toBe(32767)
  })

  it('preserves the sample count', () => {
    const out = new Int16Array(floatToPcm16(new Float32Array(480)))
    expect(out.length).toBe(480)
  })

  it('little-endian', () => {
    const buf = floatToPcm16(new Float32Array([1]))
    const bytes = new Uint8Array(buf)
    // 32767 = 0x7FFF -> LE: FF 7F
    expect(bytes[0]).toBe(0xff)
    expect(bytes[1]).toBe(0x7f)
  })
})

describe('createMicBatcher', () => {
  // AudioWorklet calls process() every fixed render quantum (128 samples at any
  // sampleRate) -- at 16kHz that's every 8ms. Hitting the WS each time (125
  // packets/sec, 256 bytes/packet) makes the Network tab look like "spam".
  // Batch before sending.

  it('does not call onFrame until the target sample count is reached', () => {
    const onFrame = vi.fn()
    const push = createMicBatcher(256, onFrame)
    push(new Float32Array(128))
    expect(onFrame).not.toHaveBeenCalled()
  })

  it('calls onFrame exactly once when enough is batched, with the right total sample count (converted to PCM16)', () => {
    const onFrame = vi.fn()
    const push = createMicBatcher(256, onFrame)
    push(new Float32Array(128))
    push(new Float32Array(128))
    expect(onFrame).toHaveBeenCalledTimes(1)
    const pcm = new Int16Array(onFrame.mock.calls[0][0] as ArrayBuffer)
    expect(pcm.length).toBe(256)
  })

  it('resets to empty after flushing -- does not merge the previous batch into the next', () => {
    const onFrame = vi.fn()
    const push = createMicBatcher(256, onFrame)
    push(new Float32Array(256)) // batch 1: full immediately, flush
    push(new Float32Array(128)) // batch 2: just started, not enough yet
    expect(onFrame).toHaveBeenCalledTimes(1)
  })

  it('merges sample contents correctly without scrambling order', () => {
    const onFrame = vi.fn()
    const push = createMicBatcher(4, onFrame)
    push(new Float32Array([1, -1]))
    push(new Float32Array([1, -1]))
    const pcm = new Int16Array(onFrame.mock.calls[0][0] as ArrayBuffer)
    expect(Array.from(pcm)).toEqual([32767, -32768, 32767, -32768])
  })

  it('overflow samples (past the target) are still sent in that batch, not dropped', () => {
    // The worklet always delivers multiples of 128 so in practice it never
    // overshoots, but the function must not silently drop data if a chunk pushes
    // the total past the target.
    const onFrame = vi.fn()
    const push = createMicBatcher(200, onFrame)
    push(new Float32Array(128))
    push(new Float32Array(128)) // total 256 > 200 -- must still flush all 256, not truncate to 200
    const pcm = new Int16Array(onFrame.mock.calls[0][0] as ArrayBuffer)
    expect(pcm.length).toBe(256)
  })
})
