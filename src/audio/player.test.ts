import { describe, expect, it } from 'vitest'
import { nextStartTime } from './player'

describe('nextStartTime', () => {
  it('lần đầu (cursor sau lưng) thì phát ngay', () => {
    // cursor=0 nghĩa là chưa phát gì; now=5 -> phải phát ~ngay, không phải lúc 0
    expect(nextStartTime(5, 0)).toBeGreaterThanOrEqual(5)
  })

  it('nối liền khi cursor còn ở tương lai', () => {
    // Đang phát tới giây 10, giờ mới 5 -> chunk sau phải nối vào 10, KHÔNG phát đè
    expect(nextStartTime(5, 10)).toBe(10)
  })

  it('cursor tụt lại sau now thì bắt kịp về now', () => {
    // Máy lag/tab ngủ khiến cursor tụt lại. Phải phát ngay, không cố phát vào
    // quá khứ (Web Audio sẽ phát tất tật cùng lúc = tiếng ồn).
    expect(nextStartTime(20, 10)).toBeGreaterThanOrEqual(20)
  })

  it('không bao giờ trả thời điểm trong quá khứ', () => {
    for (const [now, cur] of [[0, 0], [100, 1], [3.3, 3.29], [1e6, 0]]) {
      expect(nextStartTime(now, cur)).toBeGreaterThanOrEqual(now)
    }
  })
})
