import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveTokens } from './api/tokens'

vi.mock('./screens/Talk', () => ({
  Talk: ({ resumeSessionId, onResumed }: { resumeSessionId: string | null; onResumed?: () => void }) => (
    <div>
      <span>resume:{resumeSessionId ?? 'none'}</span>
      <button onClick={onResumed}>consume</button>
    </div>
  ),
}))
vi.mock('./screens/History', () => ({
  History: ({ onContinue }: { onContinue: (id: string) => void }) => (
    <button onClick={() => onContinue('s-picked')}>go-continue</button>
  ),
}))

import App from './App'

describe('App session-continue wiring', () => {
  beforeEach(() => {
    localStorage.clear()
    saveTokens('acc', 'ref')
  })

  it('starts on Talk with no session to resume', () => {
    render(<App />)
    expect(screen.getByText('resume:none')).toBeTruthy()
  })

  it('continuing a session from History returns to Talk with that id, then clears it once consumed', () => {
    render(<App />)
    fireEvent.click(screen.getByText('History'))
    fireEvent.click(screen.getByText('go-continue'))
    expect(screen.getByText('resume:s-picked')).toBeTruthy()
    fireEvent.click(screen.getByText('consume'))
    expect(screen.getByText('resume:none')).toBeTruthy()
  })
})
