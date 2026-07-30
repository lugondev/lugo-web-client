import './settings.css'

export type SettingsPanel = 'account' | 'devices' | 'tools' | 'usage'

// Ordered by how often a settled user opens them. "All devices" sits at the top
// because it is the one cross-cutting view -- the per-assistant lists cannot show
// a device that has no assistant.
const ITEMS: { id: SettingsPanel; label: string; hint: string }[] = [
  { id: 'devices', label: 'All devices', hint: 'Every paired device, by assistant' },
  { id: 'tools', label: 'Tools & voices', hint: 'Transcribe a file, try a voice' },
  { id: 'usage', label: 'My usage', hint: 'What you have spent this month' },
  { id: 'account', label: 'Account', hint: 'Sign out' },
]

/** The home for everything that is not talking or configuring an assistant.
 *
 * Exists because the app had no such place: four configuration screens sat in the
 * nav as peers of Talk, which made the nav long and said nothing about what
 * belongs to what.
 */
export function Settings({ onOpen }: { onOpen: (panel: SettingsPanel) => void }) {
  return (
    <main className="page">
      <div className="page__head">
        <h1 className="page__title">Settings</h1>
      </div>
      <p className="page__sub">Devices, tools and this account.</p>

      <ul className="list set__list">
        {ITEMS.map((it) => (
          <li key={it.id}>
            <button className="set__row" onClick={() => onOpen(it.id)}>
              <span className="set__row-text">
                <span className="set__row-label">{it.label}</span>
                <span className="set__row-hint">{it.hint}</span>
              </span>
              <span className="set__chev" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
