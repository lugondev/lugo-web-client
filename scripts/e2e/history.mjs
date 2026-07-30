import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 })
const errors = []
p.on('pageerror', e => errors.push(String(e)))
p.on('console', m => { if (m.type()==='error') errors.push('console: '+m.text().slice(0,110)) })
await p.goto('http://localhost:5173/')
await p.fill('#login-username', 'e2e-user')
await p.fill('#login-password', 'pw12345678')
await p.click('button[type="submit"]')
await p.waitForTimeout(1500)
// History is scoped to an assistant now, so it is reached from its card.
await p.click('button:has-text("Assistants")')
await p.waitForTimeout(1200)
await p.locator('[data-act="history"]').first().click()
await p.waitForTimeout(1400)
console.log('sessions shown:', await p.locator('.his__row').count())
await p.screenshot({ path: 'shots/his-list.png' })
if (await p.locator('.his__row').count() > 0) {
  await p.locator('.his__row').first().click()
  await p.waitForTimeout(1400)
  console.log('transcript turns:', await p.locator('.his__turn').count())
  const audioEls = await p.locator('audio').count()
  const hasPlayWord = (await p.content()).includes('Play')
  console.log('audio play buttons (must be 0):', audioEls, '| has "Play" text?', hasPlayWord)
  const orange = await p.evaluate(() => [...document.querySelectorAll('.page *')].filter(e => {
    const c = getComputedStyle(e); return /238,\s*106,\s*17/.test(c.color + c.backgroundColor + c.borderColor + c.backgroundImage)
  }).length)
  console.log('ORANGE elements (must be 0):', orange)
  await p.screenshot({ path: 'shots/his-detail.png' })
}
console.log('page errors:', errors.length ? errors : 'none')
await b.close()
