import { describe, expect, it } from 'vitest'
import { buildParams, wsUrl } from './conversation'

describe('wsUrl', () => {
  it('http becomes ws', () => {
    expect(wsUrl('http://localhost:8000', '/v1/conversation/stream')).toBe(
      'ws://localhost:8000/v1/conversation/stream',
    )
  })

  it('https becomes wss', () => {
    expect(wsUrl('https://api.example.com', '/v1/conversation/stream')).toBe(
      'wss://api.example.com/v1/conversation/stream',
    )
  })

  it('leaves the rest of the URL untouched', () => {
    expect(wsUrl('https://api.example.com:8443/base', '/x')).toBe('wss://api.example.com:8443/base/x')
  })
})

describe('buildParams', () => {
  it('keeps the base audio params', () => {
    const p = buildParams()
    expect(p.get('audio_out')).toBe('opus')
    expect(p.get('output')).toBe('audio,text')
    expect(p.get('sample_rate')).toBe('16000')
    expect(p.get('output_sample_rate')).toBe('24000')
  })

  it('adds profile only when given', () => {
    expect(buildParams('esp32').get('profile')).toBe('esp32')
    expect(buildParams().has('profile')).toBe(false)
    expect(buildParams('').has('profile')).toBe(false) // empty string = no profile
  })

  it('adds session_id only when given', () => {
    expect(buildParams(undefined, 's1').get('session_id')).toBe('s1')
    expect(buildParams().has('session_id')).toBe(false)
    expect(buildParams('esp32', 's1').get('session_id')).toBe('s1')
  })
})
