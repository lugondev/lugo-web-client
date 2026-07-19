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

// Talk và History cần props (nối tiếp phiên) nên render riêng bên dưới,
// không qua bản đồ Screen -> component chung như 3 màn còn lại.
const SCREENS: Record<Exclude<Screen, 'talk' | 'history'>, ComponentType> = {
  profiles: Profiles,
  devices: Devices,
  tools: Tools,
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthed())
  const [screen, setScreen] = useState<Screen>('talk')
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null)

  // Refresh thất bại ở bất kỳ request nào -> quay về Login. Đây là lý do
  // client.ts có onAuthLost thay vì tự điều hướng: lớp API không biết gì về UI.
  useEffect(() => {
    onAuthLost(() => setAuthed(false))
  }, [])

  if (!authed) return <Login onDone={() => setAuthed(true)} />

  function signOut() {
    logout()
    setAuthed(false)
    setScreen('talk')
  }

  // Từ History bấm Continue -> sang Talk và tự resume đúng phiên đó.
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
