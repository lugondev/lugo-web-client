import type { SessionRow } from '../api/history'

/** id of the most recent session, if any -- used so Start talking resumes
 * instead of always creating a new session. No sessions (brand new, or a
 * failed lookup) -> undefined, and Start talking still runs as it did before
 * this feature existed. */
export function latestSessionId(rows: SessionRow[]): string | undefined {
  return rows[0]?.id
}
