import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkAudioSupport } from './capability'

afterEach(() => vi.unstubAllGlobals())

describe('checkAudioSupport', () => {
  it('reports ok when everything is available', () => {
    vi.stubGlobal('AudioDecoder', class {})
    vi.stubGlobal('AudioContext', class {})
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => {} } })
    expect(checkAudioSupport()).toEqual({ ok: true })
  })

  it('missing AudioDecoder reports exactly what is missing', () => {
    vi.stubGlobal('AudioDecoder', undefined)
    vi.stubGlobal('AudioContext', class {})
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => {} } })
    const r = checkAudioSupport()
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.missing).toContain('AudioDecoder')
  })

  it('missing getUserMedia is reported clearly', () => {
    vi.stubGlobal('AudioDecoder', class {})
    vi.stubGlobal('AudioContext', class {})
    vi.stubGlobal('navigator', {})
    const r = checkAudioSupport()
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.missing).toContain('getUserMedia')
  })

  it('lists everything missing, not just the first one', () => {
    vi.stubGlobal('AudioDecoder', undefined)
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('navigator', {})
    const r = checkAudioSupport()
    expect(r.ok === false && r.missing.length).toBe(3)
  })
})
