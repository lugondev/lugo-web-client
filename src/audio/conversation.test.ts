import { describe, expect, it } from 'vitest'
import { wsUrl } from './conversation'

describe('wsUrl', () => {
  it('http thành ws', () => {
    expect(wsUrl('http://localhost:8000', '/v1/conversation/stream')).toBe(
      'ws://localhost:8000/v1/conversation/stream',
    )
  })

  it('https thành wss', () => {
    expect(wsUrl('https://api.example.com', '/v1/conversation/stream')).toBe(
      'wss://api.example.com/v1/conversation/stream',
    )
  })

  it('không đụng tới phần còn lại của URL', () => {
    expect(wsUrl('https://api.example.com:8443/base', '/x')).toBe('wss://api.example.com:8443/base/x')
  })
})
