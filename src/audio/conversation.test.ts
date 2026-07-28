import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildParams, Conversation, wsUrl, type TalkState } from './conversation'

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

  it('disables server-side real-time pacing (browser owns the jitter buffer)', () => {
    // See docs/superpowers/specs/2026-07-28-web-audio-jitter-buffer-design.md --
    // the 300ms server prebuffer is sized for ESP32/RPi ring buffers, not
    // browsers, which can hold seconds of audio in AudioContext instead.
    expect(buildParams().get('opus_pace')).toBe('0')
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

describe('barge-in mode', () => {
  // A speech_start arriving while Lugo is mid-reply. Auto mode drops the turn;
  // manual mode ignores it so stray noise can't chop the reply short. We poke
  // the private player/ws stubs directly -- exercising the real onMessage switch
  // without standing up AudioContext/WebSocket.
  function drive(autoInterrupt: boolean) {
    const sent: string[] = []
    let playing = true
    const conv = new Conversation({}, undefined, undefined, autoInterrupt) as unknown as {
      player: { playing: boolean; stop: () => void }
      ws: { readyState: number; send: (d: string) => void }
      onMessage: (e: MessageEvent) => void
    }
    conv.player = { get playing() { return playing }, stop: () => { playing = false } }
    conv.ws = { readyState: 1 /* OPEN */, send: (d: string) => sent.push(d) }
    conv.onMessage({ data: JSON.stringify({ event: 'speech_start' }) } as MessageEvent)
    return { sent, stopped: () => !playing }
  }

  it('auto mode stops playback and aborts the turn', () => {
    const { sent, stopped } = drive(true)
    expect(stopped()).toBe(true)
    expect(sent).toContainEqual(JSON.stringify({ type: 'abort' }))
  })

  it('manual mode keeps playing and sends no abort', () => {
    const { sent, stopped } = drive(false)
    expect(stopped()).toBe(false)
    expect(sent).toHaveLength(0)
  })
})

describe('turn_done vs. still-draining playback', () => {
  // With server pacing disabled (opus_pace=0) the server finishes SENDING a
  // turn far ahead of realtime, so turn_done lands while the browser still has
  // seconds of that turn scheduled in AudioContext. Flipping to 'listening'
  // right then swaps the Skip button for Stop (see screens/talkControl.ts) and
  // announces "Listening" while Lugo is still audibly talking.
  function harness(playing: boolean) {
    const drainCbs: Array<() => void> = []
    const conv = new Conversation({}) as unknown as {
      player: { playing: boolean; stop: () => void; onDrained: (cb: () => void) => void }
      ws: { readyState: number; send: (d: string) => void }
      state: TalkState
      onMessage: (e: MessageEvent) => void
    }
    conv.player = {
      playing,
      stop: () => {
        conv.player.playing = false
      },
      onDrained: (cb: () => void) => {
        drainCbs.push(cb)
      },
    }
    conv.ws = { readyState: 1 /* OPEN */, send: () => {} }
    conv.state = 'speaking'
    const send = (event: string) => conv.onMessage({ data: JSON.stringify({ event }) } as MessageEvent)
    return { conv, send, drain: () => drainCbs.forEach((cb) => cb()) }
  }

  it('stays speaking on turn_done while the player still has audio scheduled', () => {
    const { conv, send } = harness(true)
    send('turn_done')
    expect(conv.state).toBe('speaking')
  })

  it('becomes listening once the player drains', () => {
    const { conv, send, drain } = harness(true)
    send('turn_done')
    expect(conv.state).not.toBe('listening') // deferred, not dropped
    drain()
    expect(conv.state).toBe('listening')
  })

  it('turn_done with nothing playing still transitions immediately', () => {
    const { conv, send } = harness(false)
    send('turn_done')
    expect(conv.state).toBe('listening')
  })

  it('aborted transitions immediately regardless of player.playing', () => {
    // abort() and the speech_start barge-in path both call player.stop() BEFORE
    // the server can echo 'aborted', so there is never a tail left to wait for.
    for (const playing of [true, false]) {
      const { conv, send } = harness(playing)
      send('aborted')
      expect(conv.state).toBe('listening')
    }
  })
})

describe('abort()', () => {
  // Skip is tapped while turn_done already fired but playback is still
  // draining (see 'turn_done vs. still-draining playback' above): state is
  // 'speaking' with a pending onDrained callback and no server turn left in
  // flight. abort() cancels that pending callback via player.stop() -- so if
  // abort() doesn't ALSO transition state itself, nothing ever will: the
  // server's turn already finished, so no 'aborted' event is coming either.
  // The call would be wedged in 'speaking' forever (mic gated shut, Skip now
  // inert) until the user navigates away.
  it('transitions to listening even when no server response will ever arrive', () => {
    const sent: string[] = []
    let playing = true
    const conv = new Conversation({}) as unknown as {
      player: { playing: boolean; stop: () => void; onDrained: (cb: () => void) => void }
      ws: { readyState: number; send: (d: string) => void }
      state: TalkState
      abort: () => void
    }
    conv.player = {
      get playing() { return playing },
      stop: () => { playing = false },
      onDrained: () => {
        // Simulates the pending drain callback registered by turn_done: it
        // never fires because player.stop() (below, inside abort()) cancels
        // it. If that were the only path to 'listening', this test would
        // fail with state stuck at 'speaking'.
      },
    }
    conv.ws = { readyState: 1 /* OPEN */, send: (d: string) => sent.push(d) }
    conv.state = 'speaking'

    conv.abort()

    expect(conv.state).toBe('listening')
    expect(sent).toContainEqual(JSON.stringify({ type: 'abort' }))
  })
})
