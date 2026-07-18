import { describe, expect, it } from 'vitest'
import { emptyProfileInput, parseHeaders, serializeHeaders, toEditableInput } from './profileForm'
import type { Profile } from '../api/profiles'

describe('profileForm helpers', () => {
  it('emptyProfileInput has backend-matching defaults and no owner_id', () => {
    const e = emptyProfileInput()
    expect(e.memory.dedup_threshold).toBe(0.92)
    expect(e.session.idle_timeout_s).toBe(30)
    expect(e.memory.mode).toBe('all')
    expect('owner_id' in e).toBe(false)
  })

  it('toEditableInput blanks a masked api_key and drops owner_id', () => {
    const p = {
      ...emptyProfileInput(), owner_id: 'u1',
      llm: { base_url: '', api_key: '***', model: 'gpt', engine: 'openai' },
    } as unknown as Profile
    const e = toEditableInput(p)
    expect(e.llm.api_key).toBe('')       // never echo the mask back
    expect(e.llm.model).toBe('gpt')      // other llm fields preserved
    expect('owner_id' in e).toBe(false)
  })

  it('parseHeaders accepts a JSON object of strings', () => {
    expect(parseHeaders('{"X-Key":"v"}')).toEqual({ 'X-Key': 'v' })
    expect(parseHeaders('')).toEqual({})       // empty text = no headers
    expect(parseHeaders('  ')).toEqual({})
  })

  it('parseHeaders rejects non-objects and non-string values', () => {
    expect(() => parseHeaders('[1,2]')).toThrow()
    expect(() => parseHeaders('{"n":1}')).toThrow()
    expect(() => parseHeaders('nonsense')).toThrow()
  })

  it('serializeHeaders round-trips', () => {
    expect(parseHeaders(serializeHeaders({ a: 'b' }))).toEqual({ a: 'b' })
  })
})
