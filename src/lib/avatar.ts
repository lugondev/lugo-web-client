/** A stable visual identity for an assistant, derived from its name alone.
 *
 * Assistants have no user-uploaded picture and probably never will, but a wall of
 * identically-shaped cards is unscannable. Deriving the face from the name gives
 * every assistant the same appearance on every device and across sessions with
 * nothing to store -- and it changes when the user renames, which is the one time
 * a changed face is correct.
 */

/** Hue for a name, evenly spread around the wheel.
 *
 * FNV-1a rather than a sum of char codes: sums collide badly on anagrams and on
 * names differing by one letter ("study"/"studz"), which is exactly the case
 * where two cards must not look alike.
 */
function hueOf(name: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return Math.abs(hash) % 360
}

/** The letter shown in the avatar.
 *
 * Uses the first character of the first WORD, upper-cased with the caller's
 * locale rules. Grapheme-aware via the spread operator so an emoji or a combining
 * accent survives instead of being cut in half.
 */
export function avatarInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const [first] = [...trimmed]
  return first.toLocaleUpperCase()
}

/** Background for the avatar: a two-stop gradient in one hue family.
 *
 * Fixed saturation/lightness so every avatar carries the same visual weight --
 * a random lightness would make some cards shout and others disappear. The
 * second stop shifts hue by 24deg, enough to read as a gradient rather than a
 * flat block.
 */
export function avatarGradient(name: string): string {
  const hue = hueOf(name)
  return `linear-gradient(135deg, hsl(${hue} 62% 52%), hsl(${(hue + 24) % 360} 66% 44%))`
}
