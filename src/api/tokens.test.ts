import { beforeEach, describe, expect, it } from 'vitest'
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokens'

describe('tokens', () => {
  beforeEach(() => localStorage.clear())

  it('lưu rồi đọc lại được', () => {
    saveTokens('acc', 'ref')
    expect(getAccessToken()).toBe('acc')
    expect(getRefreshToken()).toBe('ref')
  })

  it('trả null khi chưa có gì', () => {
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('clearTokens xoá cả hai', () => {
    saveTokens('acc', 'ref')
    clearTokens()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })
})
