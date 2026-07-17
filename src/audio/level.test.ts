import { describe, expect, it } from 'vitest'
import { rmsToLevel, smoothLevel } from './level'

describe('rmsToLevel', () => {
  it('im lặng ra 0', () => {
    expect(rmsToLevel(0)).toBe(0)
  })

  it('nằm trong 0..1 với mọi đầu vào, kể cả vượt ngưỡng', () => {
    for (const v of [0, 0.001, 0.05, 0.3, 1, 5, 100]) {
      const l = rmsToLevel(v)
      expect(l).toBeGreaterThanOrEqual(0)
      expect(l).toBeLessThanOrEqual(1)
    }
  })

  it('đơn điệu tăng: to hơn thì level cao hơn', () => {
    expect(rmsToLevel(0.2)).toBeGreaterThan(rmsToLevel(0.02))
  })

  it('giọng nói bình thường ra mức thấy được, không dí sát 0', () => {
    // RMS giọng nói thường ~0.05-0.2. Nếu thang tuyến tính thì vòng tròn
    // gần như không nhúc nhích -- phải cảm nhận được.
    expect(rmsToLevel(0.1)).toBeGreaterThan(0.3)
  })
})

describe('smoothLevel', () => {
  it('lên nhanh (attack) để bắt kịp lúc bắt đầu nói', () => {
    const out = smoothLevel(0, 1, 0.5, 0.1)
    expect(out).toBeGreaterThan(0.4)
  })

  it('xuống chậm (release) để không giật cục giữa các âm tiết', () => {
    // Nếu xuống ngay lập tức, vòng tròn nhấp nháy loạn giữa từng âm tiết.
    const out = smoothLevel(1, 0, 0.5, 0.1)
    expect(out).toBeGreaterThan(0.8)
  })

  it('đứng yên khi không đổi', () => {
    expect(smoothLevel(0.5, 0.5, 0.5, 0.1)).toBeCloseTo(0.5)
  })
})
