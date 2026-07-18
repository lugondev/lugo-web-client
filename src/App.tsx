import { useEffect, useState, type ComponentType } from 'react'
import './theme.css'
import { isAuthed, logout } from './api/auth'
import { onAuthLost } from './api/client'
import { Nav, type Screen } from './components/Nav'
import { Devices } from './screens/Devices'
import { History } from './screens/History'
import { Login } from './screens/Login'
import { Talk } from './screens/Talk'
import { Tools } from './screens/Tools'

// 4 màn -- ternary lồng nhau bắt đầu khó đọc. Bản đồ Screen -> component.
const SCREENS: Record<Screen, ComponentType> = {
  talk: Talk,
  history: History,
  devices: Devices,
  tools: Tools,
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthed())
  const [screen, setScreen] = useState<Screen>('talk')

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

  const Active = SCREENS[screen]

  return (
    <>
      <Active />
      <Nav current={screen} onGo={setScreen} onLogout={signOut} />
    </>
  )
}
