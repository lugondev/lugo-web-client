import { describe, expect, it } from 'vitest'
import { controlFor } from './talkControl'

describe('controlFor', () => {
  it('shows Skip while Lugo is thinking or speaking — only ends the current turn', () => {
    expect(controlFor('thinking')).toEqual({ label: 'Skip', kind: 'skip' })
    expect(controlFor('speaking')).toEqual({ label: 'Skip', kind: 'skip' })
  })

  it('shows Stop while listening or connecting — ends the whole call', () => {
    expect(controlFor('listening')).toEqual({ label: 'Stop', kind: 'stop' })
    expect(controlFor('connecting')).toEqual({ label: 'Stop', kind: 'stop' })
  })

  it('shows Start talking when idle or errored', () => {
    expect(controlFor('idle')).toEqual({ label: 'Start talking', kind: 'start' })
    expect(controlFor('error')).toEqual({ label: 'Start talking', kind: 'start' })
  })
})
