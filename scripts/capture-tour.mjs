/**
 * GIF tour capture — page-only, privacy-safe.
 *
 * Drives the REAL app in headless Chrome over CDP: stages state via
 * tour-stage.html in the SAME tab (same origin/profile), then walks the app
 * through six scenes — home avatar TALKING (real viseme lip-sync), chat
 * streaming, wake-word listening, clipboard intelligence, publish queue,
 * memory hub — screenshotting the PAGE per frame (never the desktop).
 *
 * Usage: node scripts/capture-tour.mjs [--base http://localhost:5175]
 * Output: docs/tour-frames/scene-*.png  → stitch to docs/tour.gif with ffmpeg
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:5175'
const OUT = path.resolve('docs/tour-frames')
const PROFILE = path.join(process.env.TEMP ?? '/tmp', 'ultron-tour-profile')

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]
const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p))
if (!CHROME) { console.error('No Chrome/Edge found'); process.exit(1) }

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
fs.rmSync(PROFILE, { recursive: true, force: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map() }
  async connect() {
    this.ws = new WebSocket(this.wsUrl)
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej })
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'))
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id); this.pending.delete(msg.id)
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result)
      }
    }
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
}

async function main() {
  const port = 9333
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${port}`, '--window-size=1600,1000', 'about:blank',
  ], { stdio: 'ignore' })
  try {
    for (let i = 0; i < 60; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break } catch { await sleep(250) } }

    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = targets.find((t) => t.type === 'page')
    const cdp = new Cdp(page.webSocketDebuggerUrl)
    await cdp.connect()
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })

    const evaluate = async (expr) => (await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value
    const goto = async (url) => { await cdp.send('Page.navigate', { url }); await sleep(2800) }
    const shoot = async (name) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
      console.log('captured', name)
    }

    // Headless DOM sometimes ignores zustand-only store writes — click like a user
    const clickNav = async (label) => {
      await evaluate(`(async () => {
        const btn = [...document.querySelectorAll('nav button')].find((b) => b.textContent.trim() === '${label}')
        if (btn) btn.click()
        await new Promise((r) => setTimeout(r, 900))
        return btn ? 'nav-' + '${label}' : 'no-btn-${label}'
      })()`)
    }
    const clickSeg = async (label) => {
      await evaluate(`(async () => {
        const btn = [...document.querySelectorAll('.seg button')].find((b) => b.textContent.trim() === '${label}')
        if (btn) btn.click()
        await new Promise((r) => setTimeout(r, 600))
        return 'seg-clicked'
      })()`)
    }
    const keyPress = (key, opts = '') => evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', bubbles: true${opts} }))
      window.dispatchEvent(new KeyboardEvent('keyup', { key: '${key}', bubbles: true${opts} }))
      return 'key-${key}'
    })()`)

    // ---- Stage state IN THIS TAB (same origin → app sees it after reload)
    await goto(`${BASE}/tour-stage.html`)
    const staged = await evaluate(`document.title`)
    if (staged !== 'seeded-tour') throw new Error('staging failed: ' + staged)

    // ================= Scene 1: TALKING AVATAR =================
    // Home, then a real send from the command bar — the avatar narrates the
    // reply with real viseme lip-sync (HomeView wiring). We catch the mouth
    // wide open mid-word by polling the canvas.
    await goto(`${BASE}/`)
    await sleep(1500)
    const typeAndSend = async (text) => {
      await evaluate(`(() => {
        const ta = document.querySelector('textarea')
        if (!ta) return 'no-textarea'
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
        setter.call(ta, ${JSON.stringify(text)})
        ta.dispatchEvent(new Event('input', { bubbles: true }))
        return 'typed'
      })()`)
      await sleep(250)
      await evaluate(`(() => {
        const btn = document.querySelector('button[aria-label="Send message"]')
        if (btn) btn.click()
        return btn ? 'sent' : 'no-send-btn'
      })()`)
    }
    await typeAndSend('what are you?')
    // reply streams ~1.4s; poll for peak mouth-open across the canvas
    const mouthProbe = `(function () {
      const cv = document.querySelector('canvas')
      if (!cv) return -1
      const ctx = cv.getContext('2d')
      const px = ctx.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height * 0.62), 2, 2).data
      let sum = 0
      for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1]
      return sum
    })()`
    let best = { v: -1, t: 0 }
    const t0 = Date.now()
    while (Date.now() - t0 < 4500) {
      const v = await evaluate(mouthProbe)
      if (v > best.v) best = { v, t: Date.now() - t0 }
      await sleep(110)
    }
    await shoot('01-avatar-talking')
    await sleep(2500)

    // ================= Scene 2: wake-word LISTENING =================
    // The real mic button in the command bar — ring goes live, avatar meets
    // your eyes, "LISTENING" state. (Recognition will error silently in
    // headless; the listening UI is genuine.)
    await evaluate(`(() => {
      const mic = [...document.querySelectorAll('button')].find((b) => (b.title || b.getAttribute('aria-label') || '').includes('Voice input'))
      if (mic) mic.click()
      return mic ? 'mic-on' : 'no-mic'
    })()`)
    await sleep(1200)
    await shoot('02-listening')
    // stop it again
    await evaluate(`(() => {
      const mic = [...document.querySelectorAll('button')].find((b) => (b.title || b.getAttribute('aria-label') || '').includes('Stop listening'))
      if (mic) mic.click()
      return 'mic-off'
    })()`)
    await sleep(800)

    // ================= Scenes 3-7: chat streaming =================
    await goto(`${BASE}/`)
    await clickNav('Chat')
    await sleep(800)
    // autoBuff routes this to the viral.hook skill — a real skill run with a
    // toasts + a composed markdown reply (hook, caption, tags, thumbs)
    await typeAndSend('write a viral hook about gym day 1 vs day 30')
    await sleep(1400)
    await shoot('03-stream-0')
    let lastLen = -1
    let frame = 1
    for (let t = 0; t < 30 && frame <= 3; t++) {
      await sleep(700)
      const len = await evaluate(`document.querySelector('.app-content').innerText.length`)
      if (len !== lastLen) {
        lastLen = len
        await shoot(`03-stream-${frame}`)
        frame++
      }
    }
    await sleep(2500)

    // ================= Scene 8: clipboard intelligence =================
    // The app's own global Ctrl+Shift+V handler opens the real modal.
    await keyPress('v', ', ctrlKey: true, shiftKey: true')
    await sleep(900)
    await shoot('04-clipboard')
    await keyPress('Escape')
    await sleep(500)

    // ================= Scene 9: publish queue =================
    await clickNav('Files')
    await clickSeg('Publish queue')
    await sleep(1200)
    await shoot('05-publish')

    // ================= Scene 10: memory hub =================
    await clickNav('Memory')
    await sleep(1200)
    await shoot('06-memory')

    console.log('DONE', OUT)
  } finally {
    try { proc.kill() } catch { /* noop */ }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
