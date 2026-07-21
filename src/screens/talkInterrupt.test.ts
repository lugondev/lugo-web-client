import { describe, expect, it } from 'vitest'
import { resolveAutoInterrupt } from './talkInterrupt'

describe('resolveAutoInterrupt', () => {
  it('defaults to on when nothing is saved', () => {
    expect(resolveAutoInterrupt(null)).toBe(true)
  })

  it('is off only for the exact string "false"', () => {
    expect(resolveAutoInterrupt('false')).toBe(false)
  })

  it('is on for "true"', () => {
    expect(resolveAutoInterrupt('true')).toBe(true)
  })

  it('treats a corrupt value as on -- fail toward the familiar default', () => {
    expect(resolveAutoInterrupt('garbage')).toBe(true)
    expect(resolveAutoInterrupt('')).toBe(true)
  })
})
