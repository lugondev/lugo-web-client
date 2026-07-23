import { useEffect, useState, type ComponentType } from 'react'
import './theme.css'
import { isAuthed, logout } from './api/auth'
import { onAuthLost } from './api/client'
import { Nav, type Screen } from './components/Nav'
import { Devices } from './screens/Devices'
import { History } from './screens/History'
import { Login } from './screens/Login'
import { Profiles } from './screens/Profiles'
import { Talk } from './screens/Talk'
import { Tools } from './screens/Tools'
import { Usage } from './screens/Usage'

// Talk and History need props (session resume), so they're rendered
// explicitly below rather than through the shared Screen -> component map
// like the other three screens.
const SCREENS: Record<Exclude<Screen, 'talk' | 'history'>, ComponentType> = {
  profiles: Profiles,
  devices: Devices,
  tools: Tools,
  usage: Usage,
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthed())
  const [screen, setScreen] = useState<Screen>('talk')
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
    setScreen('talk')
  }

  // Continue from History -> go to Talk and auto-resume that exact session.
  function goToTalk(id: string) {
    setResumeSessionId(id)
    setScreen('talk')
  }

  let active
  if (screen === 'talk') {
    active = <Talk resumeSessionId={resumeSessionId} onResumed={() => setResumeSessionId(null)} />
  } else if (screen === 'history') {
    active = <History onContinue={goToTalk} />
  } else {
    const Active = SCREENS[screen]
    active = <Active />
  }

  return (
    <>
      {active}
      <Nav current={screen} onGo={setScreen} onLogout={signOut} />
    </>
  )
}
