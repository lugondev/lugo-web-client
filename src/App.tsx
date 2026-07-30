import { useEffect, useState } from 'react'
import './theme.css'
import { isAuthed, logout } from './api/auth'
import { onAuthLost } from './api/client'
import { Nav } from './components/Nav'
import { tabOf, type Route, type Tab } from './lib/route'
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
  const [route, setRoute] = useState<Route>({ screen: 'talk' })
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null)

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
    setRoute({ screen: 'talk' })
  }

  // Continue from a history entry -> go to Talk and auto-resume that session.
  function goToTalk(id: string) {
    setResumeSessionId(id)
    setRoute({ screen: 'talk' })
  }

  const backToProfiles = () => setRoute({ screen: 'profiles' })
  const backToSettings = () => setRoute({ screen: 'settings' })

  let active
  switch (route.screen) {
    case 'talk':
      active = <Talk resumeSessionId={resumeSessionId} onResumed={() => setResumeSessionId(null)} />
      break
    case 'profiles':
      active = (
        <Profiles
          onOpenDevices={(profile) => setRoute({ screen: 'profile-devices', profile })}
          onOpenHistory={(profile, title) => setRoute({ screen: 'profile-history', profile, title })}
        />
      )
      break
    case 'profile-devices':
      active = <ProfileDevices profileName={route.profile} onBack={backToProfiles} />
      break
    case 'profile-history':
      active = (
        <History
          profile={route.profile}
          profileTitle={route.title}
          onBack={backToProfiles}
          onContinue={goToTalk}
        />
      )
      break
    case 'settings':
      active = <Settings onOpen={(panel) => setRoute(PANEL_ROUTE[panel])} />
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
      <Nav current={tabOf(route)} onGo={(tab) => setRoute(TAB_ROUTE[tab])} />
    </>
  )
}
