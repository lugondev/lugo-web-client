import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 })
const errors = []
p.on('pageerror', e => errors.push(String(e)))
await p.goto('http://localhost:5173/')
await p.fill('input[aria-label="Tên đăng nhập"]', 'e2e-user')
await p.fill('input[aria-label="Mật khẩu"]', 'pw12345678')
await p.click('button[type="submit"]')
await p.waitForTimeout(1800)
const m = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Bắt đầu'))
  const r = btn.getBoundingClientRect()
  return { scrollH: document.documentElement.scrollHeight, innerH: window.innerHeight,
           btnBottom: Math.round(r.bottom), btnVisible: r.bottom <= window.innerHeight }
})
console.log('scrollHeight vs innerHeight:', m.scrollH, 'vs', m.innerH, m.scrollH<=m.innerH ? '-> KHONG tran' : '-> TRAN!')
console.log('nut chinh day:', m.btnBottom, '| nam tron trong khung:', m.btnVisible)
await p.screenshot({ path: 'shots/01-talk-idle.png' })
await p.click('text=Bắt đầu nói')
await p.waitForTimeout(3000)
await p.screenshot({ path: 'shots/02-talk-listening.png' })
console.log('loi trang:', errors.length ? errors : 'khong co')
await b.close()
