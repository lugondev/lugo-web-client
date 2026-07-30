import { describe, expect, it } from 'vitest'
import { pathOf, routeOf, tabOf, type Route } from './route'

const ALL: Route[] = [
  { screen: 'talk' },
  { screen: 'profiles' },
  { screen: 'profile-devices', profile: 'kitchen' },
  { screen: 'profile-history', profile: 'kitchen' },
  { screen: 'settings' },
  { screen: 'settings-account' },
  { screen: 'settings-devices' },
  { screen: 'settings-tools' },
  { screen: 'settings-usage' },
]

describe('tabOf', () => {
  it('lights up the parent tab from inside a child screen', () => {
    // A user who drilled into an assistant's devices is still "in Assistants";
    // a nav highlighting nothing there would read as being lost.
    expect(tabOf({ screen: 'profile-devices', profile: 'k' })).toBe('profiles')
    expect(tabOf({ screen: 'profile-history', profile: 'k' })).toBe('profiles')
    expect(tabOf({ screen: 'settings-usage' })).toBe('settings')
    expect(tabOf({ screen: 'talk' })).toBe('talk')
  })
})

describe('pathOf / routeOf', () => {
  it('round-trips every route', () => {
    for (const route of ALL) {
      expect(routeOf(pathOf(route))).toEqual(route)
    }
  })

  it('gives every route a distinct URL', () => {
    const paths = ALL.map(pathOf)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('names paths after what the user calls the screen', () => {
    // "profiles" is the store's word. The address bar is user-facing text.
    expect(pathOf({ screen: 'profiles' })).toBe('/assistants')
    expect(pathOf({ screen: 'settings-usage' })).toBe('/settings/usage')
  })

  it('survives a slug that needs escaping', () => {
    const route: Route = { screen: 'profile-history', profile: 'bếp/nhà 1' }
    const path = pathOf(route)
    expect(path).not.toContain(' ')
    // The slash inside the name must not read as another path segment.
    expect(path.split('/')).toHaveLength(4)
    expect(routeOf(path)).toEqual(route)
  })

  it('falls back to Talk for anything unrecognised', () => {
    // A typo in the address bar should cost a redirect, not a blank screen.
    for (const p of ['/nope', '/talk/extra', '', '/%%%']) {
      expect(routeOf(p)).toEqual({ screen: 'talk' })
    }
  })

  it('falls back to the section for a nonsense child of a real section', () => {
    expect(routeOf('/settings/nope')).toEqual({ screen: 'settings' })
    // An assistant is a card in the list, not a page of its own.
    expect(routeOf('/assistants/kitchen')).toEqual({ screen: 'profiles' })
    expect(routeOf('/assistants/kitchen/nope')).toEqual({ screen: 'profiles' })
  })

  it('ignores trailing and doubled slashes', () => {
    expect(routeOf('/settings/')).toEqual({ screen: 'settings' })
    expect(routeOf('//settings//account//')).toEqual({ screen: 'settings-account' })
  })

  it('does not throw on a malformed escape', () => {
    // `%` alone is not a valid escape; decodeURIComponent would throw.
    expect(routeOf('/assistants/100%/history')).toEqual({
      screen: 'profile-history',
      profile: '100%',
    })
  })
})
