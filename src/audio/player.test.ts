import { describe, expect, it } from 'vitest'
import { chunkDuration, nextStartTime, scheduleStartTime } from './player'

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

describe('scheduleStartTime', () => {
  it('gives the first chunk of a turn extra lead beyond "now"', () => {
    // cursor === 0 means nothing has been scheduled yet this turn -- nothing
    // is queued ahead to absorb a main-thread hiccup at this exact moment, so
    // this one chunk gets a small explicit cushion instead.
    expect(scheduleStartTime(5, 0)).toBeCloseTo(5.1)
  })

  it('adds no extra lead once the turn has already started (cursor ahead)', () => {
    // Later chunks already queue onto real scheduled audio -- behaves exactly
    // like nextStartTime.
    expect(scheduleStartTime(5, 10)).toBe(10)
  })

  it('still catches up to now for a mid-turn stall (cursor behind, nonzero)', () => {
    expect(scheduleStartTime(20, 10)).toBeGreaterThanOrEqual(20)
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
