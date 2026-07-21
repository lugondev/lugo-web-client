export const INTERRUPT_KEY = 'lugo.autoInterrupt'

/** Whether your voice cuts Lugo off mid-turn (auto-skip). Default true keeps the
 * original barge-in behavior; a saved 'false' means the user turned it off to
 * stop stray noise from chopping replies short. Anything but the exact string
 * 'false' reads as on -- a corrupt value should fail toward the familiar default. */
export function resolveAutoInterrupt(saved: string | null): boolean {
  return saved !== 'false'
}
