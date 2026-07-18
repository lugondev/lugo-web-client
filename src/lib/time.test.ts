import { describe, expect, it } from 'vitest'
import { isRecentlyActive, relativeTime } from './time'

const NOW = Date.parse('2026-07-17T12:00:00Z')
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString()

describe('relativeTime', () => {
  it('null thì nói thẳng là chưa từng thấy', () => {
    expect(relativeTime(null, NOW)).toBe('never connected')
  })

  it('vài giây trước', () => {
    expect(relativeTime(ago(5), NOW)).toBe('just now')
  })

  it('phút', () => {
    expect(relativeTime(ago(120), NOW)).toBe('2 min ago')
  })

  it('giờ', () => {
    expect(relativeTime(ago(3 * 3600), NOW)).toBe('3 h ago')
  })

  it('ngày', () => {
    expect(relativeTime(ago(2 * 86400), NOW)).toBe('2 d ago')
  })

  it('thời gian trong tương lai không ra số âm', () => {
    // Lệch đồng hồ giữa máy chủ và trình duyệt là chuyện thường.
    // "-3 phút trước" làm người dùng nghĩ app hỏng.
    expect(relativeTime(new Date(NOW + 60000).toISOString(), NOW)).toBe('just now')
  })

  it('chuỗi rác không làm sập, trả về thông báo trung thực', () => {
    expect(relativeTime('không-phải-ngày', NOW)).toBe('never connected')
  })
})

describe('isRecentlyActive', () => {
  it('trong 90 giây thì đang hoạt động', () => {
    expect(isRecentlyActive(ago(30), NOW)).toBe(true)
  })

  it('quá 90 giây thì không', () => {
    // Đây là ranh giới giữa sự thật và lời nói dối: last_seen chỉ được cập nhật
    // khi thiết bị mở WS, nên nói "đang hoạt động" cho một mốc cũ là bịa.
    expect(isRecentlyActive(ago(200), NOW)).toBe(false)
  })

  it('null thì không', () => {
    expect(isRecentlyActive(null, NOW)).toBe(false)
  })
})
