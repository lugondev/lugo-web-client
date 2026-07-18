import { describe, expect, it } from 'vitest'
import { resolveInitialProfile } from './talkProfile'

describe('resolveInitialProfile', () => {
  it('keeps the saved selection when it still exists', () => {
    expect(resolveInitialProfile('b', ['a', 'b', 'c'])).toBe('b')
  })
  it('falls back to the first profile when nothing is saved', () => {
    expect(resolveInitialProfile(null, ['a', 'b'])).toBe('a')
  })
  it('falls back to the first profile when the saved one is gone', () => {
    expect(resolveInitialProfile('x', ['a', 'b'])).toBe('a')
  })
  it('returns empty string when there are no profiles', () => {
    expect(resolveInitialProfile('x', [])).toBe('')
  })
})
