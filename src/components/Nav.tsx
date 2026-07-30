import type { Tab } from '../lib/route'
import './Nav.css'

// Three destinations, not six. The old nav listed every screen as a peer, so four
// configuration screens sat level with the two the user actually lives in, and at
// 320px seven controls fought for one row. Talk is the product; Assistants is
// where everything about an assistant (its config, its history, its devices)
// hangs off; Settings is the account-level rest.
//
// Sign out is deliberately NOT here any more -- it's a rare action, not a
// destination, and it now lives in Settings > Account.
const ITEMS: { id: Tab; label: string }[] = [
  { id: 'talk', label: 'Talk' },
  { id: 'profiles', label: 'Assistants' },
  { id: 'settings', label: 'Settings' },
]

export function Nav({ current, onGo }: { current: Tab; onGo: (t: Tab) => void }) {
  return (
    <nav className="nav" aria-label="Main navigation">
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
    </nav>
  )
}
