import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'] })
const p = await b.newPage()
const artifactHits = []
p.on('request', r => { if (r.url().includes('/artifacts/')) artifactHits.push(r.url()) })
p.on('console', m => { const t=m.text(); if (/error|fail|Opus|decode/i.test(t)) console.log('  [console]', t.slice(0,160)) })
p.on('websocket', ws => {
  console.log('  [ws] ->', ws.url().replace(/token=[^&]+/,'token=***').slice(0,90))
  let up=0, down=0
  ws.on('framesent', () => { up++ })
  ws.on('framereceived', () => { down++ })
  ws.on('close', () => console.log(`  [ws] closed. frames up=${up} down=${down}`))
  setTimeout(()=>console.log(`  [ws] frames up=${up} down=${down}`), 43000)
})
await p.addInitScript(() => {
  window.__decoded = []
  const Orig = window.AudioDecoder
  window.AudioDecoder = class extends Orig {
    constructor(init) {
      super({ error: init.error, output: (data) => {
        const pcm = new Float32Array(data.numberOfFrames)
        try { data.copyTo(pcm, { planeIndex: 0, format: 'f32-planar' }) } catch(e) { window.__copyErr = String(e) }
        let s=0; for (const v of pcm) s += v*v
        window.__decoded.push({ frames: data.numberOfFrames, rate: data.sampleRate, rms: Math.sqrt(s/pcm.length) })
        init.output(data)
      }})
    }
  }
})
await p.goto('http://localhost:5173/talk-probe.html')
await p.click('#go')
await p.waitForTimeout(4000)
await p.click('#say')          // kich mot luot tra loi qua text: di dung duong LLM->TTS->Opus->decode
await p.waitForTimeout(40000)
const d = await p.evaluate(() => window.__decoded)
const log = await p.textContent('#log')
const states = await p.evaluate(() => window.__state)
console.log('--- log trang ---\n' + log)
console.log('states:', JSON.stringify(states))
const total = d.reduce((s,x)=>s+x.frames,0)
console.log('chunk giai ma:', d.length)
console.log('tong frame:', total, '=', (total/24000).toFixed(2), 'giay audio')
const rates = [...new Set(d.map(x=>x.rate))]
console.log('sample rate THUC TE:', JSON.stringify(rates))
console.log('frame/chunk:', JSON.stringify([...new Set(d.map(x=>x.frames))]))
console.log('sample rate khac 24000:', d.filter(x=>x.rate!==24000).length)
console.log('chunk KHONG im lang:', d.filter(x=>x.rms>0.001).length, '/', d.length)
const realSec = d.reduce((s,x)=>s+x.frames/x.rate,0)
console.log('thoi luong THAT (dung rate decoder):', realSec.toFixed(2), 'giay')
console.log('neu tin hang 24000 thi se la:', (total/24000).toFixed(2), 'giay  <- lech = loi phat cham')
console.log('request /artifacts (phai 0):', artifactHits.length)
await b.close()
