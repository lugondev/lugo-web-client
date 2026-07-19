import { describe, expect, it } from 'vitest'
import { rmsToLevel, smoothLevel } from './level'

describe('rmsToLevel', () => {
  it('silence gives 0', () => {
    expect(rmsToLevel(0)).toBe(0)
  })

  it('stays within 0..1 for any input, even over the threshold', () => {
    for (const v of [0, 0.001, 0.05, 0.3, 1, 5, 100]) {
      const l = rmsToLevel(v)
      expect(l).toBeGreaterThanOrEqual(0)
      expect(l).toBeLessThanOrEqual(1)
    }
  })

  it('monotonically increasing: louder means a higher level', () => {
    expect(rmsToLevel(0.2)).toBeGreaterThan(rmsToLevel(0.02))
  })

  it('normal speech gives a visible level, not pinned near 0', () => {
    // Speech RMS is typically ~0.05-0.2. On a linear scale the circle would
    // barely move -- it has to be noticeable.
    expect(rmsToLevel(0.1)).toBeGreaterThan(0.3)
  })
})

describe('smoothLevel', () => {
  it('rises fast (attack) to catch the start of speech', () => {
    const out = smoothLevel(0, 1, 0.5, 0.1)
    expect(out).toBeGreaterThan(0.4)
  })

  it('falls slow (release) so it does not jerk between syllables', () => {
    // If it fell instantly, the circle would flicker wildly between syllables.
    const out = smoothLevel(1, 0, 0.5, 0.1)
    expect(out).toBeGreaterThan(0.8)
  })

  it('stays put when unchanged', () => {
    expect(smoothLevel(0.5, 0.5, 0.5, 0.1)).toBeCloseTo(0.5)
  })
})
