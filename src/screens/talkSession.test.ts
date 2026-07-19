import { describe, expect, it } from 'vitest'
import { latestSessionId } from './talkSession'

const ROW = (id: string) => ({
  id, profile_id: 'p', user_id: null, created_at: null, ended_at: null,
  meta: {}, message_count: 0, preview: '',
})

describe('latestSessionId', () => {
  it('returns the id of the first (most recent) row', () => {
    expect(latestSessionId([ROW('s1'), ROW('s2')])).toBe('s1')
  })
  it('returns undefined when there are no sessions', () => {
    expect(latestSessionId([])).toBeUndefined()
  })
})
