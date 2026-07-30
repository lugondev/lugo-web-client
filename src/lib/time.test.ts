import { describe, expect, it } from 'vitest'
import { isRecentlyActive, messageTime, relativeTime } from './time'

const NOW = Date.parse('2026-07-17T12:00:00Z')
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString()

describe('relativeTime', () => {
  it('null says plainly it was never seen', () => {
    expect(relativeTime(null, NOW)).toBe('never connected')
  })

  it('a few seconds ago', () => {
    expect(relativeTime(ago(5), NOW)).toBe('just now')
  })

  it('minutes', () => {
    expect(relativeTime(ago(120), NOW)).toBe('2 min ago')
  })

  it('hours', () => {
    expect(relativeTime(ago(3 * 3600), NOW)).toBe('3 h ago')
  })

  it('days', () => {
    expect(relativeTime(ago(2 * 86400), NOW)).toBe('2 d ago')
  })

  it('future times do not go negative', () => {
    // Clock skew between server and browser is common.
    // "-3 min ago" makes users think the app is broken.
    expect(relativeTime(new Date(NOW + 60000).toISOString(), NOW)).toBe('just now')
  })

  it('garbage string does not crash, returns an honest message', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('never connected')
  })
})

describe('messageTime', () => {
  // Built from local components on purpose: the clock a reader sees is their
  // own, so these assertions must hold in any TZ the suite runs in.
  const local = (y: number, mo: number, d: number, h: number, mi: number) =>
    new Date(y, mo, d, h, mi).toISOString()
  const TODAY = new Date(2026, 6, 17, 12, 0).getTime()

  it('same day is just the clock, in 24h', () => {
    expect(messageTime(local(2026, 6, 17, 14, 32), TODAY)).toBe('14:32')
  })

  it('pads a single-digit hour and minute', () => {
    expect(messageTime(local(2026, 6, 17, 9, 5), TODAY)).toBe('09:05')
  })

  it('an earlier day carries its date, otherwise the clock lies about when', () => {
    expect(messageTime(local(2026, 6, 15, 9, 5), TODAY)).toBe('15 Jul 09:05')
  })

  it('same day-of-month in another month is not mistaken for today', () => {
    expect(messageTime(local(2026, 5, 17, 9, 5), TODAY)).toBe('17 Jun 09:05')
  })

  it('missing or unparseable timestamps render nothing at all', () => {
    // Rows written before the server sent per-message times: show no time
    // rather than a fabricated one.
    expect(messageTime(null, TODAY)).toBe('')
    expect(messageTime(undefined, TODAY)).toBe('')
    expect(messageTime('not-a-date', TODAY)).toBe('')
  })
})

describe('isRecentlyActive', () => {
  it('within 90 seconds it is active', () => {
    expect(isRecentlyActive(ago(30), NOW)).toBe(true)
  })

  it('past 90 seconds it is not', () => {
    // This is the line between truth and a lie: last_seen is only updated when the
    // device opens a WS, so calling an old timestamp "active" is fabrication.
    expect(isRecentlyActive(ago(200), NOW)).toBe(false)
  })

  it('null is not', () => {
    expect(isRecentlyActive(null, NOW)).toBe(false)
  })
})
