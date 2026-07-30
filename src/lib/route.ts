/** Where the app is.
 *
 * A flat string union stopped being enough once screens gained children: History
 * and the device list are now reached *through* an assistant and need to know
 * which one, and Tools/Usage/Account sit under Settings. Encoding that as a
 * discriminated union keeps the parameters attached to the screens that need
 * them, instead of a pile of loose "selectedProfile"-style state in App.
 */
export type Route =
  | { screen: 'talk' }
  | { screen: 'profiles' }
  /** One assistant's devices, including pairing a new one into it. */
  | { screen: 'profile-devices'; profile: string }
  /** One assistant's conversations. There is no global history view.
   *
   * `title` rides along because the screen must show the assistant's nickname,
   * and `profile` is the store KEY (a slug). The hub already knows the nickname;
   * passing it beats making History fetch the profile just to render a heading,
   * and beats showing users a slug they never chose to see. */
  | { screen: 'profile-history'; profile: string; title: string }
  | { screen: 'settings' }
  | { screen: 'settings-account' }
  | { screen: 'settings-devices' }
  | { screen: 'settings-tools' }
  | { screen: 'settings-usage' }

/** The three top-level destinations the nav shows. */
export type Tab = 'talk' | 'profiles' | 'settings'

/** Which nav tab a route belongs to.
 *
 * Child routes light up their parent tab: a user who drilled into an assistant's
 * devices is still "in Assistants", and a nav that highlighted nothing there
 * would read as being lost.
 */
export function tabOf(route: Route): Tab {
  if (route.screen === 'talk') return 'talk'
  if (route.screen.startsWith('settings')) return 'settings'
  return 'profiles'
}
