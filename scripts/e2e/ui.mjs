import { chromium } from 'playwright'
const b = await chromium.launch()
const errors = []
// The UI is English now; this guard flags any leftover Vietnamese by scanning
// for the full Vietnamese Unicode range (toned/circumflex vowels included).
const VN_RANGE = /[À-ỹ]/
async function vnHits(page) {
  const txt = await page.evaluate(() => document.body.innerText)
  return txt.split(/\s+/).filter(w => VN_RANGE.test(w))
}
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
p.on('pageerror', e => errors.push(String(e)))
p.on('console', m => { if (m.type()==='error') errors.push('console:'+m.text().slice(0,90)) })

// login
await p.goto('http://localhost:5173/')
await p.waitForTimeout(900)
console.log('LOGIN vn:', await vnHits(p)); await p.screenshot({ path:'shots/ui-login.png' })
await p.fill('#login-username','e2e-user')
await p.fill('#login-password','pw12345678')
await p.click('button:has-text("Sign in")'); await p.waitForTimeout(1500)

// talk
console.log('TALK vn:', await vnHits(p)); await p.screenshot({ path:'shots/ui-talk.png' })

// history (per assistant now -- reached from a card, not the nav)
await p.click('button:has-text("Assistants")'); await p.waitForTimeout(1200)
console.log('ASSISTANTS vn:', await vnHits(p)); await p.screenshot({ path:'shots/ui-profiles.png' })
await p.locator('[data-act="history"]').first().click(); await p.waitForTimeout(1200)
console.log('HISTORY vn:', await vnHits(p)); await p.screenshot({ path:'shots/ui-history.png' })
if (await p.locator('.his__row').count()) { await p.locator('.his__row').first().click(); await p.waitForTimeout(1000); console.log('HIST DETAIL vn:', await vnHits(p)); await p.screenshot({ path:'shots/ui-history-detail.png' }); await p.click('button:has-text("Back")'); await p.waitForTimeout(500) }

// devices + modal keyboard drive (one assistant's devices)
await p.click('button:has-text("‹ Assistants")'); await p.waitForTimeout(600)
await p.locator('[data-act="devices"]').first().click(); await p.waitForTimeout(1200)
console.log('DEVICES vn:', await vnHits(p)); await p.screenshot({ path:'shots/ui-devices.png' })
const before = await p.locator('.drow').count()
if (before) {
  await p.locator('.menu__trigger').first().click(); await p.waitForTimeout(200)
  await p.locator('[role=menuitem]:has-text("Remove device")').first().click(); await p.waitForTimeout(500)
  const dlg = await p.locator('[role=dialog]').count()
  const focusIn = await p.evaluate(() => document.querySelector('[role=dialog]')?.contains(document.activeElement))
  await p.screenshot({ path:'shots/ui-modal.png' })
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  const afterEsc = await p.locator('[role=dialog]').count()
  const stillThere = await p.locator('.drow').count()
  console.log('MODAL: dialog opened=', dlg, '| focus inside=', focusIn, '| Esc closed=', afterEsc===0, '| device NOT removed=', stillThere===before)
}

// tools
await p.click('button:has-text("Tools")'); await p.waitForTimeout(900)
console.log('TOOLS vn:', await vnHits(p)); await p.screenshot({ path:'shots/ui-tools.png' })

// nav at 320
const p2 = await b.newPage({ viewport:{ width:320, height:720 } })
await p2.goto('http://localhost:5173/'); await p2.fill('#login-username','e2e-user'); await p2.fill('#login-password','pw12345678'); await p2.click('button:has-text("Sign in")'); await p2.waitForTimeout(1400)
const navRows = await p2.evaluate(() => new Set([...document.querySelectorAll('.nav button')].map(b=>Math.round(b.getBoundingClientRect().top))).size)
console.log('NAV 320px rows (1=ok):', navRows)

console.log('page errors:', errors.length ? errors : 'none')
await b.close()
