import { describe, expect, it } from 'vitest'
import { avatarColors, avatarInitial } from './avatar'

describe('avatarInitial', () => {
  it('takes the first letter, upper-cased', () => {
    expect(avatarInitial('kitchen')).toBe('K')
    expect(avatarInitial('Study buddy')).toBe('S')
  })

  it('ignores leading whitespace instead of rendering a blank tile', () => {
    expect(avatarInitial('  hello')).toBe('H')
  })

  it('falls back to ? rather than an empty avatar', () => {
    expect(avatarInitial('')).toBe('?')
    expect(avatarInitial('   ')).toBe('?')
  })

  it('keeps a multi-byte first character whole', () => {
    // A naive name[0] would slice a surrogate pair in half and render a
    // replacement glyph.
    expect(avatarInitial('🎧 headphones')).toBe('🎧')
    expect(avatarInitial('Đà Nẵng')).toBe('Đ')
  })
})

describe('avatarColors', () => {
  it('is stable for the same name', () => {
    expect(avatarColors('kitchen')).toEqual(avatarColors('kitchen'))
  })

  it('separates names that differ by one letter', () => {
    // The whole point of hashing rather than summing char codes: near-identical
    // names are exactly the pair a user must be able to tell apart at a glance.
    expect(avatarColors('study').bg).not.toBe(avatarColors('studz').bg)
    expect(avatarColors('ab').bg).not.toBe(avatarColors('ba').bg)
  })

  it('produces usable CSS values', () => {
    const { bg, fg } = avatarColors('kitchen')
    expect(bg).toMatch(/^hsl\(\d+ \d+% \d+%\)$/)
    expect(fg).toMatch(/^hsl\(\d+ \d+% \d+%\)$/)
  })

  it('never lands on the orange band reserved for the live signal', () => {
    // An avatar that reads as "this one is on" would be a lie: the tile is an
    // identity, not a state.
    for (const name of ['a', 'kitchen', 'ESP32', 'Đà Nẵng', 'zzzzzz', 'host', 'rpi']) {
      const hue = Number(/^hsl\((\d+)/.exec(avatarColors(name).bg)?.[1])
      expect(hue).toBeGreaterThanOrEqual(120)
      expect(hue).toBeLessThanOrEqual(330)
    }
  })
})
