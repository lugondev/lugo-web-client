import { act, render, screen, fireEvent } from '@testing-library/react'
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
    onOpenHistory: (p: string) => void
  }) => (
    <div>
      <button onClick={() => onOpenHistory('mine')}>open-history</button>
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

/** Drive the Back button the way a browser does: the entry is already popped
 *  off, then popstate fires. jsdom's own history.back() is async and would make
 *  every assertion a race. */
function goBack(to: string) {
  window.history.replaceState(null, '', to)
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

describe('App navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    saveTokens('acc', 'ref')
    window.history.replaceState(null, '', '/')
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

  it('puts every destination in the address bar', () => {
    render(<App />)
    expect(window.location.pathname).toBe('/')

    fireEvent.click(screen.getByText('Assistants'))
    expect(window.location.pathname).toBe('/assistants')

    fireEvent.click(screen.getByText('open-devices'))
    expect(window.location.pathname).toBe('/assistants/mine/devices')

    fireEvent.click(screen.getByText('Settings'))
    fireEvent.click(screen.getByText('My usage'))
    expect(window.location.pathname).toBe('/settings/usage')
  })

  it('opens the screen the URL names, with no navigation first', () => {
    // The point of the address bar: a bookmark, a reload or a shared link has to
    // land where it says, not on Talk.
    window.history.replaceState(null, '', '/assistants/mine/devices')
    render(<App />)
    expect(screen.getByText('devices-of:mine')).toBeTruthy()
    expect(screen.getByText('Assistants').getAttribute('aria-current')).toBe('page')
  })

  it('Back returns to the previous screen instead of leaving the app', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Assistants'))
    fireEvent.click(screen.getByText('open-history'))
    expect(screen.getByText('history-of:mine')).toBeTruthy()

    goBack('/assistants')
    expect(screen.queryByText('history-of:mine')).toBeNull()
    expect(screen.getByText('open-history')).toBeTruthy()
  })

  it('rewrites an address that resolved to something else', () => {
    // Landing on Talk while the bar still reads /nope would be the app lying
    // about where it is.
    window.history.replaceState(null, '', '/nope')
    render(<App />)
    expect(screen.getByText('resume:none')).toBeTruthy()
    expect(window.location.pathname).toBe('/')
  })

  it('keeps the resumed session out of the URL', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Assistants'))
    fireEvent.click(screen.getByText('open-history'))
    fireEvent.click(screen.getByText('go-continue'))
    // It is a one-shot instruction Talk consumes, not a place -- a reload must
    // not silently reopen that conversation.
    expect(screen.getByText('resume:s-picked')).toBeTruthy()
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('')
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
