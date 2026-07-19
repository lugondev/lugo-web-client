import { describe, expect, it } from 'vitest'
import { chunkDuration, nextStartTime } from './player'

describe('nextStartTime', () => {
  it('plays immediately the first time (cursor is behind)', () => {
    // cursor=0 means nothing has played yet; now=5 -> must play ~now, not at 0
    expect(nextStartTime(5, 0)).toBeGreaterThanOrEqual(5)
  })

  it('appends seamlessly when the cursor is still in the future', () => {
    // Playing up to second 10, now only 5 -> next chunk must join at 10, NOT overlap
    expect(nextStartTime(5, 10)).toBe(10)
  })

  it('catches up to now when the cursor has fallen behind', () => {
    // A lagging machine / sleeping tab makes the cursor fall behind. Must play
    // now, not try to play into the past (Web Audio would play it all at once = noise).
    expect(nextStartTime(20, 10)).toBeGreaterThanOrEqual(20)
  })

  it('never returns a time in the past', () => {
    for (const [now, cur] of [[0, 0], [100, 1], [3.3, 3.29], [1e6, 0]]) {
      expect(nextStartTime(now, cur)).toBeGreaterThanOrEqual(now)
    }
  })
})

describe('chunkDuration', () => {
  it('uses the decoder REAL rate (48k), not the configured rate (24k)', () => {
    // 2880 frames/packet at 60ms @48k -- figures measured on Chromium 149
    expect(chunkDuration(2880, 48000)).toBeCloseTo(0.06)
  })

  it('trusting 24000 gives double the duration -- exactly the half-speed bug', () => {
    expect(chunkDuration(2880, 24000)).toBeCloseTo(0.12)
    expect(chunkDuration(2880, 24000)).not.toBeCloseTo(chunkDuration(2880, 48000))
  })
})
