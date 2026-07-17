import { describe, expect, it } from 'vitest'
import { floatToPcm16 } from './mic'

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
