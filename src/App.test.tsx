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
  History: ({ onContinue, profile }: { onContinue: (id: string) => void; profile?: string }) => (
    <div>
      <span>history-of:{profile ?? 'all'}</span>
      <button onClick={() => onContinue('s-picked')}>go-continue</button>
    </div>
  ),
}))
// History and the device list are reached THROUGH an assistant now, so the hub
// stands in for the card actions that lead to them.
vi.mock('./screens/Profiles', () => ({
  Profiles: ({
    onOpenDevices,
    onOpenHistory,
  }: {
    onOpenDevices: (p: string) => void
    onOpenHistory: (p: string, title: string) => void
  }) => (
    <div>
      <button onClick={() => onOpenHistory('mine', 'Mine')}>open-history</button>
      <button onClick={() => onOpenDevices('mine')}>open-devices</button>
    </div>
  ),
}))
vi.mock('./screens/profiles/ProfileDevices', () => ({
  ProfileDevices: ({ profileName }: { profileName: string }) => (
    <span>devices-of:{profileName}</span>
  ),
}))

import App from './App'

describe('App navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    saveTokens('acc', 'ref')
  })

  it('starts on Talk with no session to resume', () => {
    render(<App />)
    expect(screen.getByText('resume:none')).toBeTruthy()
  })

  it('shows three destinations and no Sign out in the nav', () => {
    render(<App />)
    const nav = screen.getByRole('navigation')
    expect([...nav.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Talk', 'Assistants', 'Settings',
    ])
    // Sign out is an action, not a destination -- it lives in Settings > Account.
    expect(screen.queryByText('Sign out')).toBeNull()
  })

  it('continuing a session from an assistant\'s history returns to Talk with that id', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Assistants'))
    fireEvent.click(screen.getByText('open-history'))
    expect(screen.getByText('history-of:mine')).toBeTruthy()

    fireEvent.click(screen.getByText('go-continue'))
    expect(screen.getByText('resume:s-picked')).toBeTruthy()
    fireEvent.click(screen.getByText('consume'))
    expect(screen.getByText('resume:none')).toBeTruthy()
  })

  it('opens a single assistant\'s device list', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Assistants'))
    fireEvent.click(screen.getByText('open-devices'))
    expect(screen.getByText('devices-of:mine')).toBeTruthy()
  })

  it('keeps the Assistants tab marked current inside its child screens', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Assistants'))
    fireEvent.click(screen.getByText('open-devices'))
    // A nav that highlighted nothing here would read as being lost.
    expect(screen.getByText('Assistants').getAttribute('aria-current')).toBe('page')
  })

  it('reaches every settings panel and back', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Settings'))
    fireEvent.click(screen.getByText('All devices'))
    expect(screen.getByRole('heading', { name: 'All devices' })).toBeTruthy()
    expect(screen.getByText('Settings').getAttribute('aria-current')).toBe('page')

    fireEvent.click(screen.getByRole('button', { name: '‹ Settings' }))
    fireEvent.click(screen.getByText('Account'))
    expect(screen.getByRole('heading', { name: 'Account' })).toBeTruthy()
  })

  it('signs out from Settings > Account', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Settings'))
    fireEvent.click(screen.getByText('Account'))
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    // Back to the login screen: no nav, no Talk.
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
