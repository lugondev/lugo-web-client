import { describe, expect, it, vi } from 'vitest'
import { createMicBatcher, floatToPcm16 } from './mic'

describe('floatToPcm16', () => {
  it('0 thành 0', () => {
    const out = new Int16Array(floatToPcm16(new Float32Array([0])))
    expect(out[0]).toBe(0)
  })

  it('biên +1 và -1 không tràn số', () => {
    const out = new Int16Array(floatToPcm16(new Float32Array([1, -1])))
    expect(out[0]).toBe(32767)
    expect(out[1]).toBe(-32768)
  })

  it('cắt ngưỡng giá trị ngoài [-1,1] thay vì để quấn vòng', () => {
    // Quấn vòng biến đỉnh sóng thành tiếng nổ lách tách -- lỗi kinh điển.
    const out = new Int16Array(floatToPcm16(new Float32Array([2, -2, 1.5])))
    expect(out[0]).toBe(32767)
    expect(out[1]).toBe(-32768)
    expect(out[2]).toBe(32767)
  })

  it('giữ đúng số mẫu', () => {
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
  // AudioWorklet gọi process() mỗi render quantum cố định (128 mẫu ở mọi
  // sampleRate) -- ở 16kHz đó là 8ms/lần. Gửi WS ngay mỗi lần (125 gói/giây,
  // 256 byte/gói) làm Network tab trông như "spam". Gộp lại trước khi gửi.

  it('không gọi onFrame cho tới khi đủ số mẫu mục tiêu', () => {
    const onFrame = vi.fn()
    const push = createMicBatcher(256, onFrame)
    push(new Float32Array(128))
    expect(onFrame).not.toHaveBeenCalled()
  })

  it('gọi onFrame đúng một lần khi gộp đủ, với đúng tổng số mẫu (đã chuyển PCM16)', () => {
    const onFrame = vi.fn()
    const push = createMicBatcher(256, onFrame)
    push(new Float32Array(128))
    push(new Float32Array(128))
    expect(onFrame).toHaveBeenCalledTimes(1)
    const pcm = new Int16Array(onFrame.mock.calls[0][0] as ArrayBuffer)
    expect(pcm.length).toBe(256)
  })

  it('reset về rỗng sau khi flush -- không gộp chồng batch trước vào batch sau', () => {
    const onFrame = vi.fn()
    const push = createMicBatcher(256, onFrame)
    push(new Float32Array(256)) // batch 1: đủ ngay, flush
    push(new Float32Array(128)) // batch 2: mới bắt đầu, chưa đủ
    expect(onFrame).toHaveBeenCalledTimes(1)
  })

  it('gộp đúng nội dung mẫu, không làm rối thứ tự', () => {
    const onFrame = vi.fn()
    const push = createMicBatcher(4, onFrame)
    push(new Float32Array([1, -1]))
    push(new Float32Array([1, -1]))
    const pcm = new Int16Array(onFrame.mock.calls[0][0] as ArrayBuffer)
    expect(Array.from(pcm)).toEqual([32767, -32768, 32767, -32768])
  })

  it('mẫu dư thừa (vượt mục tiêu) vẫn được gửi trong batch đó, không bị cắt mất', () => {
    // Worklet luôn cấp bội số của 128 nên trong thực tế không lệch, nhưng
    // hàm không được âm thầm làm rớt dữ liệu nếu một chunk đưa tổng vượt target.
    const onFrame = vi.fn()
    const push = createMicBatcher(200, onFrame)
    push(new Float32Array(128))
    push(new Float32Array(128)) // tổng 256 > 200 -- vẫn phải flush đủ 256, không cắt còn 200
    const pcm = new Int16Array(onFrame.mock.calls[0][0] as ArrayBuffer)
    expect(pcm.length).toBe(256)
  })
})
