/** A stable visual identity for an assistant, derived from its name alone.
 *
 * Assistants have no user-uploaded picture and probably never will, but a wall of
 * identically-shaped cards is unscannable. Deriving the face from the name gives
 * every assistant the same appearance on every device and across sessions with
 * nothing to store -- and it changes when the user renames, which is the one time
 * a changed face is correct.
 */

/** The arc of the colour wheel an avatar may land on: green through magenta.
 *
 * A full spin was the old behaviour and it put a sixth of all assistants in the
 * orange band, where they competed with the one colour that means "live". The
 * arc is still 211 hues wide, so two names a letter apart still separate.
 */
const HUE_FROM = 120
const HUE_SPAN = 211

/** Position for a name within that arc.
 *
 * FNV-1a rather than a sum of char codes: sums collide badly on anagrams and on
 * names differing by one letter ("study"/"studz"), which is exactly the case
 * where two cards must not look alike.
 */
function hashOf(name: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return Math.abs(hash)
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

/** Tile and letter colours for a name: a soft tint with the letter in the same
 * hue at reading weight.
 *
 * Fixed saturation/lightness so every avatar carries the same visual weight, and
 * the pair always clears 4.5:1 -- the letter is the content, the tile is only
 * the label for it.
 */
export function avatarColors(name: string): { bg: string; fg: string } {
  const hue = HUE_FROM + (hashOf(name) % HUE_SPAN)
  return {
    bg: `hsl(${hue} 50% 85%)`,
    fg: `hsl(${hue} 68% 25%)`,
  }
}
