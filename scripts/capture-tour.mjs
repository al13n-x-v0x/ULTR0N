/**
 * GIF tour capture — page-only, privacy-safe.
 *
 * Drives the REAL app in headless Chrome over CDP: stages state via
 * tour-stage.html in the SAME tab (so localStorage lands on the right origin
 * and profile), walks the app through its views (home avatar, chat streaming,
 * publish queue, memory), and screenshots the PAGE per scene.
 *
 * Usage: node scripts/capture-tour.mjs [--base http://localhost:5175]
 * Output: docs/tour-frames/scene-*.png  → then stitched to docs/tour.gif
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

    // ---- Stage state IN THIS TAB (same origin → app sees it after reload)
    await goto(`${BASE}/tour-stage.html`)
    const staged = await evaluate(`document.title`)
    if (staged !== 'seeded-tour') throw new Error('staging failed: ' + staged)

    // ---- Scene 1: Home with avatar + greeting
    await goto(`${BASE}/`)
    await evaluate(`(async () => {
      const ai = await import('/src/store/aiStore.ts')
      const msgs = window.__ULTRON_TOUR_MESSAGES ?? []
      ai.useAi.setState({ messages: [{ id: 'banner', role: 'assistant', kind: 'info', text: 'U.L.T.R.0.N. // Unified Logic, Tactical Reasoning & Zero-Point Network\\nOn-device. Offline. Yours.', ts: Date.now() - 60000 }, ...msgs] })
      return 'chat-restored'
    })()`)
    await sleep(2000)
    await shoot('01-home-avatar')

    // ---- Scenes 2-6: REAL send through the app's own UI (same module instance
    // as the app — CDP import() gets a different copy, so we drive like a user).
    // The heuristic local core types its answer out char-by-char — genuine
    // streaming frames, no network needed.
    await goto(`${BASE}/`)
    await clickNav('Chat')
    await sleep(800)
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
    // autoBuff routes this to the viral.hook skill — a real skill run with a
    // toasts + a composed markdown reply (hook, caption, tags, thumbs)
    await typeAndSend('write a viral hook about gym day 1 vs day 30')
    // user bubble + pending ack first
    await sleep(1400)
    await shoot('02-stream-0')
    // the skill runs the AI then composes — shoot while text is still growing
    let lastLen = -1
    let frame = 1
    for (let t = 0; t < 30 && frame <= 5; t++) {
      await sleep(700)
      const len = await evaluate(`document.querySelector('.app-content').innerText.length`)
      if (len !== lastLen) { // content changed → this frame shows progress
        lastLen = len
        await shoot(`02-stream-${frame}`)
        frame++
      }
    }
    // let the reply settle fully before the next scene
    await sleep(2500)

    // ---- Scene 7: publish queue (AI preview + thumbnails + statuses)
    await clickNav('Files')
    await clickSeg('Publish queue')
    await sleep(1200)
    await shoot('03-publish')

    // ---- Scene 8: memory view
    await clickNav('Memory')
    await sleep(1200)
    await shoot('04-memory')

    console.log('DONE', OUT)
  } finally {
    try { proc.kill() } catch { /* noop */ }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
