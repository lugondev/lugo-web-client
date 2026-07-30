import { useCallback, useEffect, useState } from 'react'
import './theme.css'
import { isAuthed, logout } from './api/auth'
import { onAuthLost } from './api/client'
import { Nav } from './components/Nav'
import { pathOf, routeOf, tabOf, type Route, type Tab } from './lib/route'
import { History } from './screens/History'
import { Login } from './screens/Login'
import { Profiles } from './screens/Profiles'
import { ProfileDevices } from './screens/profiles/ProfileDevices'
import { Account } from './screens/settings/Account'
import { AllDevices } from './screens/settings/AllDevices'
import { Settings, type SettingsPanel } from './screens/settings/Settings'
import { Talk } from './screens/Talk'
import { Tools } from './screens/Tools'
import { Usage } from './screens/Usage'

// Where each nav tab lands. Child routes (an assistant's devices, a settings
// panel) are reached from inside their parent, never from the nav.
const TAB_ROUTE: Record<Tab, Route> = {
  talk: { screen: 'talk' },
  profiles: { screen: 'profiles' },
  settings: { screen: 'settings' },
}

const PANEL_ROUTE: Record<SettingsPanel, Route> = {
  account: { screen: 'settings-account' },
  devices: { screen: 'settings-devices' },
  tools: { screen: 'settings-tools' },
  usage: { screen: 'settings-usage' },
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthed())
  // The URL is the source of truth for where we are, so a reload, a bookmark or
  // a shared link all land where they say they do.
  const [route, setRoute] = useState<Route>(() => routeOf(window.location.pathname))
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null)

  /** Navigate, and record it so Back returns here. */
  const go = useCallback((next: Route) => {
    setRoute(next)
    const path = pathOf(next)
    if (path !== window.location.pathname) window.history.pushState(null, '', path)
  }, [])

  // Back and Forward move through the app rather than out of it.
  useEffect(() => {
    const onPop = () => setRoute(routeOf(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // An address that resolved to something else -- a typo, a stale link, a
  // trailing slash -- is rewritten to the canonical path for what is actually on
  // screen. Replace, not push: the URL that never rendered is not a place to go
  // Back to.
  useEffect(() => {
    const path = pathOf(route)
    if (path !== window.location.pathname) window.history.replaceState(null, '', path)
    // Only on mount: afterwards `go` keeps the two in step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A refresh failure on any request -> back to Login. This is why
  // client.ts has onAuthLost instead of navigating itself: the API layer
  // knows nothing about the UI.
  useEffect(() => {
    onAuthLost(() => setAuthed(false))
  }, [])

  if (!authed) return <Login onDone={() => setAuthed(true)} />

  function signOut() {
    logout()
    setAuthed(false)
    go({ screen: 'talk' })
  }

  // Continue from a history entry -> go to Talk and auto-resume that session.
  // The session id stays out of the URL: it is a one-shot instruction Talk
  // consumes, not a place, and a reload must not silently reopen it.
  function goToTalk(id: string) {
    setResumeSessionId(id)
    go({ screen: 'talk' })
  }

  const backToProfiles = () => go({ screen: 'profiles' })
  const backToSettings = () => go({ screen: 'settings' })

  let active
  switch (route.screen) {
    case 'talk':
      active = <Talk resumeSessionId={resumeSessionId} onResumed={() => setResumeSessionId(null)} />
      break
    case 'profiles':
      active = (
        <Profiles
          onOpenDevices={(profile) => go({ screen: 'profile-devices', profile })}
          onOpenHistory={(profile) => go({ screen: 'profile-history', profile })}
        />
      )
      break
    case 'profile-devices':
      active = <ProfileDevices profileName={route.profile} onBack={backToProfiles} />
      break
    case 'profile-history':
      active = (
        <History profile={route.profile} onBack={backToProfiles} onContinue={goToTalk} />
      )
      break
    case 'settings':
      active = <Settings onOpen={(panel) => go(PANEL_ROUTE[panel])} />
      break
    case 'settings-account':
      active = <Account onBack={backToSettings} onSignOut={signOut} />
      break
    case 'settings-devices':
      active = <AllDevices onBack={backToSettings} />
      break
    case 'settings-tools':
      active = <Tools onBack={backToSettings} />
      break
    case 'settings-usage':
      active = <Usage onBack={backToSettings} />
      break
  }

  return (
    <>
      {active}
      <Nav current={tabOf(route)} onGo={(tab) => go(TAB_ROUTE[tab])} />
    </>
  )
}
