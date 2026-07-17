import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkAudioSupport } from './capability'

afterEach(() => vi.unstubAllGlobals())

describe('checkAudioSupport', () => {
  it('đủ khả năng thì ok', () => {
    vi.stubGlobal('AudioDecoder', class {})
    vi.stubGlobal('AudioContext', class {})
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => {} } })
    expect(checkAudioSupport()).toEqual({ ok: true })
  })

  it('thiếu AudioDecoder thì báo rõ thiếu gì', () => {
    vi.stubGlobal('AudioDecoder', undefined)
    vi.stubGlobal('AudioContext', class {})
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => {} } })
    const r = checkAudioSupport()
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.missing).toContain('AudioDecoder')
  })

  it('thiếu getUserMedia thì báo rõ', () => {
    vi.stubGlobal('AudioDecoder', class {})
    vi.stubGlobal('AudioContext', class {})
    vi.stubGlobal('navigator', {})
    const r = checkAudioSupport()
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.missing).toContain('getUserMedia')
  })

  it('thiếu nhiều thứ thì liệt kê hết, không dừng ở cái đầu', () => {
    vi.stubGlobal('AudioDecoder', undefined)
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('navigator', {})
    const r = checkAudioSupport()
    expect(r.ok === false && r.missing.length).toBe(3)
  })
})
