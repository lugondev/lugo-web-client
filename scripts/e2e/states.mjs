import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] })
const p = await b.newPage({ viewport: { width: 420, height: 500 }, deviceScaleFactor: 2 })
await p.goto('http://localhost:5173/')
await p.fill('#login-username', 'e2e-user')
await p.fill('#login-password', 'pw12345678')
await p.click('button[type="submit"]')
await p.waitForTimeout(1500)
for (const s of ['thinking','speaking','error']) {
  await p.evaluate((st) => document.querySelector('svg.mark')?.setAttribute('data-state', st), s)
  await p.waitForTimeout(500)
  const el = await p.$('svg.mark')
  await el.screenshot({ path: `shots/mark-${s}.png` })
  const col = await p.evaluate(() => {
    const r = document.querySelector('.mark__ring'), d = document.querySelector('.mark__dot')
    const cs = getComputedStyle(r), ds = getComputedStyle(d)
    return { ringStroke: cs.stroke, ringOpacity: cs.opacity, ringAnim: cs.animationName, dotFill: ds.fill }
  })
  console.log(s, JSON.stringify(col))
}
// reduced motion
const p2 = await b.newPage({ viewport: { width: 420, height: 500 } })
await p2.emulateMedia({ reducedMotion: 'reduce' })
await p2.goto('http://localhost:5173/')
await p2.fill('#login-username', 'e2e-user')
await p2.fill('#login-password', 'pw12345678')
await p2.click('button[type="submit"]')
await p2.waitForTimeout(1500)
await p2.evaluate(() => document.querySelector('svg.mark')?.setAttribute('data-state','thinking'))
await p2.waitForTimeout(400)
console.log('reduced-motion thinking animationName:', await p2.evaluate(() => getComputedStyle(document.querySelector('.mark__ring')).animationName))
await b.close()
