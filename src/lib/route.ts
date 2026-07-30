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
   * Only the store KEY travels, and History resolves the nickname itself the way
   * ProfileDevices already does. The hub used to hand the nickname over to save
   * a request, but a route has to survive being retyped or bookmarked, and a
   * nickname is not in the URL. */
  | { screen: 'profile-history'; profile: string }
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

/** The URL for a route.
 *
 * Paths are named after what the user calls the screen ("assistants"), not after
 * the store ("profiles"): the address bar is user-facing text.
 */
export function pathOf(route: Route): string {
  switch (route.screen) {
    case 'talk': return '/'
    case 'profiles': return '/assistants'
    case 'profile-devices': return `/assistants/${encodeURIComponent(route.profile)}/devices`
    case 'profile-history': return `/assistants/${encodeURIComponent(route.profile)}/history`
    case 'settings': return '/settings'
    case 'settings-account': return '/settings/account'
    case 'settings-devices': return '/settings/devices'
    case 'settings-tools': return '/settings/tools'
    case 'settings-usage': return '/settings/usage'
  }
}

const SETTINGS_PANELS: Record<string, Route> = {
  account: { screen: 'settings-account' },
  devices: { screen: 'settings-devices' },
  tools: { screen: 'settings-tools' },
  usage: { screen: 'settings-usage' },
}

/** The route a URL means.
 *
 * Total, never throws: anything unrecognised lands on Talk rather than a blank
 * screen, and a path that names a real section but a nonsense child lands on
 * that section. A typo in the address bar should cost the user a redirect, not
 * the app.
 */
export function routeOf(pathname: string): Route {
  const seg = pathname.split('/').filter(Boolean).map(decodeSegment)

  if (seg[0] === 'assistants') {
    // /assistants/<slug>/<child>. A bare /assistants/<slug> is not a screen --
    // an assistant is a card in the list, not a page of its own.
    if (seg[2] === 'devices') return { screen: 'profile-devices', profile: seg[1] }
    if (seg[2] === 'history') return { screen: 'profile-history', profile: seg[1] }
    return { screen: 'profiles' }
  }
  if (seg[0] === 'settings') return SETTINGS_PANELS[seg[1]] ?? { screen: 'settings' }
  return { screen: 'talk' }
}

/** decodeURIComponent, but a malformed escape yields the raw segment instead of
 *  throwing -- `%` alone in a hand-typed URL must not take the app down. */
function decodeSegment(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
