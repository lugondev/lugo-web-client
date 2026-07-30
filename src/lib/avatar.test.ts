import { describe, expect, it } from 'vitest'
import { avatarGradient, avatarInitial } from './avatar'

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

describe('avatarGradient', () => {
  it('is stable for the same name', () => {
    expect(avatarGradient('kitchen')).toBe(avatarGradient('kitchen'))
  })

  it('separates names that differ by one letter', () => {
    // The whole point of hashing rather than summing char codes: near-identical
    // names are exactly the pair a user must be able to tell apart at a glance.
    expect(avatarGradient('study')).not.toBe(avatarGradient('studz'))
    expect(avatarGradient('ab')).not.toBe(avatarGradient('ba'))
  })

  it('produces a usable CSS value', () => {
    expect(avatarGradient('kitchen')).toMatch(/^linear-gradient\(135deg, hsl\(\d+ /)
  })
})
