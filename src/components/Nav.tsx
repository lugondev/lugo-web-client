import './Nav.css'

export type Screen = 'talk' | 'history' | 'devices' | 'tools' | 'profiles' | 'usage'

// Only list screens that ACTUALLY exist. A nav pointing to a missing screen lies
// to the user. Ordered by decreasing frequency of use: Talk is the main thing,
// History is what you check after talking, Profiles configures the assistant,
// Devices configures hardware, Tools is the occasional odd job, Usage is the
// least-visited (checked occasionally, not part of the core loop).
const ITEMS: { id: Screen; label: string }[] = [
  { id: 'talk', label: 'Talk' },
  { id: 'history', label: 'History' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'devices', label: 'Devices' },
  { id: 'tools', label: 'Tools' },
  { id: 'usage', label: 'My Usage' },
]

export function Nav({
  current,
  onGo,
  onLogout,
}: {
  current: Screen
  onGo: (s: Screen) => void
  onLogout: () => void
}) {
  return (
    <nav className="nav" aria-label="Main navigation">
      {/* Four real screens, level with each other -- grouped separately and centered in
          the space left after making room for Sign out. */}
      <div className="nav__tabs">
        {ITEMS.map((it) => (
          <button
            key={it.id}
            className="nav__btn"
            aria-current={current === it.id ? 'page' : undefined}
            onClick={() => onGo(it.id)}
          >
            {it.label}
          </button>
        ))}
      </div>
      <span className="nav__divider" aria-hidden="true" />
      {/* Sign out is an ACTION, not a screen -- deliberately NOT using nav__btn (no
          aria-current, no pill/tab look) so it doesn't read as a peer of
          Talk/History/Devices/Tools. */}
      <button className="nav__logout" onClick={onLogout}>
        Sign out
      </button>
    </nav>
  )
}
