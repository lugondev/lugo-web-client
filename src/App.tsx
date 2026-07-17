import { useEffect, useState } from 'react'
import './theme.css'
import { isAuthed, logout } from './api/auth'
import { onAuthLost } from './api/client'
import { Login } from './routes/Login'
import { Talk } from './routes/Talk'

export default function App() {
  const [authed, setAuthed] = useState(isAuthed())

  // Refresh thất bại ở bất kỳ request nào -> quay về Login. Đây là lý do
  // client.ts có onAuthLost thay vì tự điều hướng: lớp API không biết gì về UI.
  useEffect(() => {
    onAuthLost(() => setAuthed(false))
  }, [])

  if (!authed) return <Login onDone={() => setAuthed(true)} />
  return (
    <Talk
      onLogout={() => {
        logout()
        setAuthed(false)
      }}
    />
  )
}
