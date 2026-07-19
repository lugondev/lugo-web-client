import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildParams, Conversation, wsUrl } from './conversation'

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

describe('disconnect while connecting', () => {
  // A browser fires `onerror` when you close() a socket that is still in the
  // CONNECTING state. React StrictMode double-invokes the resume effect, so the
  // first Conversation is disconnect()ed mid-handshake -- and that self-inflicted
  // teardown must NOT surface as a user-facing "connection lost".
  class ConnectingWs {
    static instances: ConnectingWs[] = []
    onerror: ((e: unknown) => void) | null = null
    onclose: (() => void) | null = null
    onopen: (() => void) | null = null
    onmessage: (() => void) | null = null
    binaryType = ''
    readyState = 0 // CONNECTING
    constructor() { ConnectingWs.instances.push(this) }
    close() {
      // Aborting a still-connecting socket: the browser reports an error first,
      // then closes.
      this.onerror?.(new Event('error'))
      this.onclose?.()
    }
    send() {}
  }

  beforeEach(() => {
    ConnectingWs.instances = []
    vi.stubGlobal('WebSocket', ConnectingWs as unknown as typeof WebSocket)
    localStorage.setItem('lugo.access_token', 'test-token')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('does not report an error when we disconnect our own connecting socket', async () => {
    const onError = vi.fn()
    const conv = new Conversation({ onError })
    await conv.connect()
    conv.disconnect()
    expect(onError).not.toHaveBeenCalled()
  })
})
