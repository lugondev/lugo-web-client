import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import './settings.css'

/** Account-level actions.
 *
 * Deliberately does not display the username: this client authenticates with a
 * bearer token, and the server's only identity endpoint (`/api/auth/status`)
 * reads the cookie session, so it would answer "not authenticated" here. Showing
 * a guessed or cached name would be worse than showing none.
 */
export function Account({ onBack, onSignOut }: { onBack: () => void; onSignOut: () => void }) {
  return (
    <main className="set">
      <div className="set__bar">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ‹ Settings
        </Button>
      </div>
      <h1 className="set__h">Account</h1>

      <Card className="set__card">
        <p className="set__note">
          Signing out removes this browser&apos;s access. Your paired devices keep working —
          they have their own pairing and are not affected.
        </p>
        <Button variant="danger" onClick={onSignOut}>
          Sign out
        </Button>
      </Card>
    </main>
  )
}
