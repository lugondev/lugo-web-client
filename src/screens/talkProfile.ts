export const PROFILE_KEY = 'lugo.talkProfile'

/** Pick the initial profile: keep the saved choice if it still exists, otherwise take
 * the first in the list. '' means no profile (use the server default). */
export function resolveInitialProfile(saved: string | null, names: string[]): string {
  if (saved && names.includes(saved)) return saved
  return names[0] ?? ''
}
