import { describe, expect, it } from 'vitest'
import { isRecentlyActive, relativeTime } from './time'

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
