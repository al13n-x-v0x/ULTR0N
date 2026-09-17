#!/usr/bin/env node
/**
 * U.L.T.R.0.N. CLI — npm install -g ultr0n
 * Aliases installed: ultr0n, ultron, ultron-cli, ultra0n (same binary).
 *
 *   ultron start              web UI + bridge in one shot
 *   ultron serve              run the laptop-control bridge
 *   ultron open youtube       open a site/app through the bridge
 *   ultron publish clip.mp4   AI title → real YouTube upload
 *   ultron ask "…"            ask the local model (Ollama/OpenAI-compatible)
 *   ultron status             bridge health at a glance
 *   ultron doctor             full environment check
 *   ultron models             list installed local models
 *   ultron exec "cmd"         run a shell command via the bridge (token-gated)
 *   ultron auth               YouTube OAuth flow through the bridge
 *   ultron token <secret>     save the bridge token
 *   ultron uninstall          remove config (keeps you clean)
 *
 * Zero dependencies — Node 18+ stdlib only. By al13n-x-v0x
 */
import http from 'node:http'
import { spawn, execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'))

const CY = (s) => `\x1b[36m${s}\x1b[0m`
const DIM = (s) => `\x1b[2m${s}\x1b[0m`
const GRN = (s) => `\x1b[32m${s}\x1b[0m`
const YLW = (s) => `\x1b[33m${s}\x1b[0m`
const RED = (s) => `\x1b[31m${s}\x1b[0m`
const B = (s) => `\x1b[1m${s}\x1b[0m`

const LOGO = `
   ██╗   ██╗██╗     ███████████████ ████████ ██████  ███    ██
   ██║   ██║██║        ██║  ██╔════╝    ██║   ██╔══██╗████╗  ██║
   ██║   ██║██║  ███╗ ██║  █████╗      ██║   ██████╔╝██╔██╗ ██║
   ██║   ██║██║   ██║ ██║  ██╔══╝      ██║   ██╔══██╗██║╚██╗██║
   ╚██████╔╝██║  ███╗██║   ███████╗ ██║   ██║  ██║██║ ╚████║
    ╚═════╝ ╚═╝  ╚══╝ ╚═╝   ╚══════╝ ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝
   ${DIM('on-device AI assistant shell — by al13n-x-v0x')}
`

/* ------------------------------ config ------------------------------ */

const CONFIG_DIR = path.join(os.homedir(), '.ultr0n')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) } catch { return {} }
}
function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n')
  try { fs.chmodSync(CONFIG_FILE, 0o600) } catch { /* best effort */ }
}

const cfg = loadConfig()
const PORT = Number(cfg.port || process.env.ULTRON_PORT || 8765)
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN = cfg.token || process.env.ULTRON_TOKEN || ''

/* ------------------------------ http ------------------------------ */

function request(method, urlPath, body, { raw = false } = {}) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : JSON.stringify(body)
    const req = http.request(`${BASE}${urlPath}`, {
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(TOKEN ? { 'x-ultron-token': TOKEN } : {}),
      },
      timeout: raw ? 3_600_000 : 12_000,
    }, (res) => {
      let out = ''
      res.on('data', (c) => { out += c })
      res.on('end', () => {
        if (raw) return resolve({ status: res.statusCode, text: out })
        try { resolve({ status: res.statusCode, json: JSON.parse(out || '{}') }) }
        catch { resolve({ status: res.statusCode, json: { error: out.slice(0, 300) } }) }
      })
    })
    req.on('timeout', () => { req.destroy(new Error('timeout')) })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function bridgeHealth() {
  try { return (await request('GET', '/health')).json } catch { return null }
}

/* ------------------------------ helpers ------------------------------ */

const isWin = process.platform === 'win32'
const NPM = isWin ? 'npm.cmd' : 'npm'

function repoRoot() {
  // dev usage: this file lives in <repo>/cli — packaged usage: dist + bridge shipped too
  const maybe = path.resolve(__dirname, '..')
  if (fs.existsSync(path.join(maybe, 'bridge', 'ultron-bridge.mjs'))) return maybe
  return __dirname
}

function bridgeScript() {
  const packed = path.join(__dirname, 'bridge', 'ultron-bridge.mjs')
  if (fs.existsSync(packed)) return packed
  return path.join(repoRoot(), 'bridge', 'ultron-bridge.mjs')
}

function webDist() {
  const a = path.join(__dirname, 'dist')
  if (fs.existsSync(path.join(a, 'index.html'))) return a
  const b = path.join(repoRoot(), 'dist')
  if (fs.existsSync(path.join(b, 'index.html'))) return b
  return null
}

function bridgeEnv(extra = {}) {
  return { ...process.env, ULTRON_PORT: String(PORT), ...(TOKEN ? {} : {}), ...extra }
}

function die(msg, hint) {
  console.error(RED(`\n  ✗ ${msg}`))
  if (hint) console.error(DIM(`    ${hint}`))
  process.exit(1)
}

function openBrowser(url) {
  if (isWin) spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
  else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
  else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
}

async function waitFor(url, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try { await request('GET', url); return true } catch { await new Promise(r => setTimeout(r, 250)) }
  }
  return false
}

async function confirm(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const a = await new Promise((res) => rl.question(YLW(`  ? ${q} `), res))
  rl.close()
  return /^(y|yes)$/i.test(a.trim())
}

/* ------------------------------ commands ------------------------------ */

const HELP = `
${B('ultr0n')} ${DIM(PKG.version)} — the whole U.L.T.R.0.N. shell from one command
${DIM('aliases: ultron, ultron-cli, ultra0n — all identical')}

${CY('GET RUNNING')}
  ${B('ultron start')}              start bridge + web UI + open browser        ${DIM('(the one-liner)')}
  ${B('ultron serve')}              bridge only — laptop control for the web app
  ${B('ultron ui')}                 web UI only (static build, no bridge)

${CY('DO THINGS')}
  ${B('ultron open')} <site|url>    open youtube / instagram / any URL via bridge
  ${B('ultron app')} <name>         launch notepad / calc / explorer / terminal / paint
  ${B('ultron publish')} <file>     AI viral title → real YouTube upload ${DIM('[--public|--private|--unlisted] [--topic "..."]')}
  ${B('ultron ask')} "…"            quick question to your local model ${DIM('[--model qwen2.5:0.5b]')}
  ${B('ultron exec')} "cmd"         shell command through the bridge ${DIM('(token-gated)')}

${CY('SETUP & DIAGNOSTICS')}
  ${B('ultron status')}             bridge health at a glance
  ${B('ultron doctor')}             full environment check + fixes
  ${B('ultron models')}             list installed Ollama / local models
  ${B('ultron auth')}               YouTube OAuth consent (needs GOOGLE_CLIENT_ID/SECRET in bridge env)
  ${B('ultron token')} <secret>     save bridge token to ~/.ultr0n/config.json
  ${B('ultron update')}             npm update -g ultr0n
  ${B('ultron uninstall')}          remove ~/.ultr0n config

${CY('GLOBAL FLAGS')}
  --port <n>   bridge port ${DIM('(default 8765)')}      --json   machine-readable output
  --no-open    start without opening the browser
`

const OPEN_MAP = {
  youtube: 'https://youtube.com',
  yt: 'https://youtube.com',
  instagram: 'https://instagram.com',
  insta: 'https://instagram.com',
  ig: 'https://instagram.com',
  x: 'https://x.com',
  twitter: 'https://x.com',
  reddit: 'https://reddit.com',
  github: 'https://github.com',
  gmail: 'https://mail.google.com',
  drive: 'https://drive.google.com',
  spotify: 'https://open.spotify.com',
  twitch: 'https://twitch.tv',
}

const APP_MAP = ['notepad', 'calc', 'explorer', 'terminal', 'paint']

async function cmdStart(args, flags) {
  console.log(CY(LOGO))
  const health = await bridgeHealth()
  let spawned = null
  if (!health) {
    console.log(DIM('  ▸ starting bridge…'))
    spawned = spawn(process.execPath, [bridgeScript()], {
      env: bridgeEnv(), stdio: 'ignore', detached: !isWin, windowsHide: true,
    })
    spawned.unref()
    const ok = await waitFor('/health', 15_000)
    if (!ok) die('bridge did not become healthy', 'try: ultron serve   (logs in the foreground)')
  } else {
    console.log(GRN('  ✓ bridge already running') + DIM(`  :${PORT}`))
  }
  const h = (await bridgeHealth()) || {}
  console.log(`  ${h.commandsEnabled ? GRN('✓ commands enabled') : YLW('○ commands off — set a token: ultron token <secret>')}`)
  console.log(`  ${h.youtubeConfigured ? GRN('✓ youtube configured') : YLW('○ youtube not configured')}${h.ffmpeg ? GRN('  ✓ ffmpeg') : DIM('  ○ ffmpeg absent')}`)

  const dist = webDist()
  if (!dist) {
    console.log(YLW('\n  ○ web UI build not bundled — cloning repo version…'))
    die('no dist/ found', 'in the repo: npm run build, or use the desktop app')
  }

  const { createServer } = await import('node:http')
  const ui = createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname
    const f = path.join(dist, p === '/' ? 'index.html' : p)
    if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      const index = path.join(dist, 'index.html')
      if (!fs.existsSync(index)) { res.writeHead(404); return res.end('no dist') }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      return res.end(fs.readFileSync(index))
    }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm' }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' })
    res.end(fs.readFileSync(f))
  })
  const uiPort = await new Promise((res) => {
    const s = ui.listen(0, '127.0.0.1', () => res(s.address().port))
  })
  const url = `http://localhost:${uiPort}`
  console.log(GRN(`\n  ⚡ U.L.T.R.0.N. is live → ${B(url)}`))
  console.log(DIM('  bridge ' + BASE + '  ·  Ctrl+C to stop\n'))
  if (!flags['no-open']) openBrowser(url)
  const shut = () => { try { ui.close() } catch { /* noop */ } if (spawned && !isWin) { try { process.kill(-spawned.pid) } catch { spawned.kill() } } process.exit(0) }
  process.on('SIGINT', shut)
  process.on('SIGTERM', shut)
}

async function cmdServe() {
  console.log(CY(LOGO))
  const child = spawn(process.execPath, [bridgeScript()], { env: bridgeEnv(), stdio: 'inherit', windowsHide: true })
  child.on('exit', (c) => process.exit(c ?? 0))
}

async function cmdUi() {
  const dist = webDist() || die('no bundled web UI', 'rebuild: npm run build')
  const { createServer } = await import('node:http')
  const ui = createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname
    let f = path.join(dist, p === '/' ? 'index.html' : p)
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html')
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' })
    res.end(fs.readFileSync(f))
  })
  ui.listen(0, '127.0.0.1', () => {
    const url = `http://localhost:${ui.address().port}`
    console.log(GRN(`  ⚡ UI → ${B(url)}`) + DIM('   (bridge not started — run ultron serve alongside)'))
    openBrowser(url)
  })
}

async function cmdOpen(args) {
  const target = (args[0] || '').toLowerCase()
  if (!target) die('what should I open?', 'ultron open youtube · instagram · https://…')
  const url = OPEN_MAP[target] || (/^https?:\/\//.test(target) ? target : `https://${target}`)
  if (!(await bridgeHealth())) die('bridge not running', 'ultron serve   — then retry')
  const r = await request('POST', '/open', { url })
  r.json?.ok ? console.log(GRN(`  ✓ opened ${url}`)) : die(r.json?.error || 'open failed')
}

async function cmdApp(args) {
  const app = (args[0] || '').toLowerCase()
  if (!app) die('which app?', `known: ${APP_MAP.join(', ')}`)
  if (!(await bridgeHealth())) die('bridge not running', 'ultron serve')
  const r = await request('POST', '/open', { app })
  r.json?.ok ? console.log(GRN(`  ✓ launched ${app}`)) : die(r.json?.error || 'launch failed')
}

async function cmdPublish(args, flags) {
  const file = args[0]
  if (!file || !fs.existsSync(file)) die('video file not found', 'ultron publish clip.mp4 --topic "gym day"')
  const privacy = flags.public ? 'public' : flags.private ? 'private' : 'unlisted'
  const topic = flags.topic || path.basename(file, path.extname(file))
  if (!(await bridgeHealth())) die('bridge not running', 'ultron serve')
  if (!flags.yes && !(await confirm(`upload "${path.basename(file)}" to YouTube (${privacy})?`))) { console.log(DIM('  cancelled')); return }

  process.stdout.write('  ▸ writing viral title… ')
  const title = await aiTitle(topic).catch(() => fallbackTitle(topic))
  console.log(GRN(title))

  const stat = fs.statSync(file)
  const abs = path.resolve(file)
  const up = await request('POST', '/youtube/upload', {
    path: abs, title,
    description: `${title}\n\nmade with U.L.T.R.0.N. — @al13n-x-v0x`,
    tags: ['shorts', ...topic.toLowerCase().split(/\s+/).slice(0, 4)],
    privacy, size: stat.size,
  })
  if (!up.json?.ok) die(up.json?.error || 'upload init failed', up.status === 401 ? 'ultron token <secret>' : 'check GOOGLE_CLIENT_ID/SECRET')
  console.log(`  ▸ uploading ${(stat.size / 1e6).toFixed(1)} MB …`)
  const job = await pollJob(up.json.jobId)
  if (job.status === 'done') console.log(GRN(`\n  ✓ LIVE → https://youtu.be/${job.videoId}`))
  else die(job.error || 'upload failed')
}

async function pollJob(id) {
  for (;;) {
    const r = await request('GET', `/youtube/job?id=${id}`).catch(() => null)
    const job = r?.json?.job
    if (!job) die('lost the upload job')
    if (job.status === 'done' || job.status === 'error') return job
    await new Promise(res => setTimeout(res, 2000))
    process.stdout.write(DIM('.'))
  }
}

async function cmdAsk(args, flags) {
  const q = args.join(' ').trim()
  if (!q) die('ask what?', 'ultron ask "explain webgpu in one line"')
  const base = cfg.modelBase || process.env.ULTRON_MODEL_BASE || 'http://127.0.0.1:11434'
  const model = flags.model || cfg.model || 'qwen2.5:0.5b'
  try {
    const r = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: q, stream: false }),
    })
    const j = await r.json()
    if (j.error) die(`ollama: ${j.error}`, `fix: ollama pull ${model}`)
    console.log(j.response?.trim() || DIM('(empty response)'))
  } catch {
    die(`no local model at ${base}`, 'install Ollama: https://ollama.com · then: ollama pull ' + model)
  }
}

async function cmdStatus() {
  const h = await bridgeHealth()
  if (!h) { console.log(YLW('  ○ bridge: offline') + DIM(`   (${BASE}) — start it: ultron serve`)); return }
  console.log(GRN('  ● bridge: online') + DIM(`   :${PORT}  v${h.version}`))
  console.log(`    commands: ${h.commandsEnabled ? GRN('enabled') : YLW('no token')}`)
  console.log(`    youtube:  ${h.youtubeConfigured ? GRN('configured') : DIM('not configured')}`)
  console.log(`    ffmpeg:   ${h.ffmpeg ? GRN('found') : DIM('missing (captions disabled)')}`)
  console.log(`    platform: ${h.platform}`)
}

async function cmdDoctor() {
  console.log(CY(LOGO))
  const checks = []
  checks.push(['node ' + process.version.split(' ')[0], true])
  const h = await bridgeHealth()
  checks.push([`bridge online :${PORT}`, !!h])
  if (h) {
    checks.push(['commands token set', h.commandsEnabled])
    checks.push(['google/youtube keys', h.youtubeConfigured])
    checks.push(['ffmpeg (captions + burn-in)', h.ffmpeg])
  }
  let ollama = false
  try { ollama = (await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2500) })).ok } catch { /* off */ }
  checks.push(['ollama (local models)', ollama])
  if (ollama) {
    try {
      const j = await (await fetch('http://127.0.0.1:11434/api/tags')).json()
      checks.push([`models installed (${(j.models || []).length})`, (j.models || []).length > 0])
    } catch { /* skip */ }
  }
  for (const [label, ok] of checks) console.log(`  ${ok ? GRN('✓') : RED('✗')} ${label}`)
  console.log('')
  if (!h) console.log(DIM('  fix: ultron serve   (or ultron start for UI too)'))
  if (h && !h.commandsEnabled) console.log(DIM('  fix: ultron token <secret>   (same value the bridge runs with)'))
  if (h && !h.youtubeConfigured) console.log(DIM('  fix: set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET, restart bridge, then: ultron auth'))
  if (h && !h.ffmpeg) console.log(DIM('  fix: winget install ffmpeg   (or set FFMPEG_PATH)'))
  if (!ollama) console.log(DIM('  fix: https://ollama.com → then: ollama pull qwen2.5:0.5b'))
}

async function cmdModels() {
  try {
    const j = await (await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) })).json()
    const models = j.models || []
    if (!models.length) return console.log(YLW('  no models pulled yet — try: ollama pull qwen2.5:0.5b'))
    for (const m of models) console.log(`  ${CY('◆')} ${m.name}  ${DIM(`(${(m.size / 1e9).toFixed(1)} GB)`)}`)
  } catch {
    die('no Ollama at 127.0.0.1:11434', 'install: https://ollama.com')
  }
}

async function cmdAuth() {
  if (!(await bridgeHealth())) die('bridge not running', 'ultron serve')
  console.log('  ▸ opening Google consent in your browser…')
  openBrowser(`${BASE}/youtube/auth`)
  console.log(DIM('  complete the consent, then upload with: ultron publish clip.mp4'))
}

async function cmdToken(args) {
  const t = args[0]
  if (!t) die('usage: ultron token <secret>')
  saveConfig({ ...cfg, token: t })
  console.log(GRN(`  ✓ token saved to ${CONFIG_FILE}`))
  console.log(DIM('  restart the bridge with the same value: ULTRON_TOKEN=<secret> ultron serve'))
}

async function cmdUpdate() {
  console.log(DIM('  updating…'))
  execFile(NPM, ['update', '-g', PKG.name], { stdio: 'inherit', windowsHide: true })
}

async function cmdUninstall() {
  if (await confirm('remove ~/.ultr0n config (token, prefs)?')) {
    fs.rmSync(CONFIG_DIR, { recursive: true, force: true })
    console.log(GRN('  ✓ config removed'))
  }
  console.log(DIM('  to remove the package too: npm uninstall -g ' + PKG.name))
}

/* ------------------------------ router ------------------------------ */

function parseFlags(argv) {
  const flags = {}
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--port') { flags.port = Number(argv[++i]) }
    else if (a === '--model') { flags.model = argv[++i] }
    else if (a === '--topic') { flags.topic = argv[++i] }
    else if (a === '--json') { flags.json = true }
    else if (a === '--no-open') { flags['no-open'] = true }
    else if (a === '--public') { flags.public = true }
    else if (a === '--private') { flags.private = true }
    else if (a === '--unlisted') { flags.unlisted = true }
    else if (a === '--yes' || a === '-y') { flags.yes = true }
    else rest.push(a)
  }
  return { flags, rest }
}

async function aiTitle(topic) {
  const base = cfg.modelBase || 'http://127.0.0.1:11434'
  const model = cfg.model || 'qwen2.5:0.5b'
  const prompt = `Write ONE viral YouTube video title (max 60 chars, no quotes) about: ${topic}\nTitle:`
  const r = await fetch(`${base}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  })
  const j = await r.json()
  const t = (j.response || '').trim().split('\n')[0].replace(/^["']|["']$/g, '').slice(0, 100)
  if (!t) throw new Error('empty')
  return t
}

function fallbackTitle(topic) {
  const T = topic.charAt(0).toUpperCase() + topic.slice(1)
  const forms = [`${T} — You Won't Believe #4`, `I Tried ${T} For 24 Hours`, `${T}: The 60-Second Version`, `Why Everyone Is Talking About ${T}`]
  return forms[Math.floor(Math.random() * forms.length)]
}

const [, , cmdRaw, ...restArgs] = process.argv
const { flags, rest } = parseFlags(restArgs)
const cmd = (cmdRaw || 'help').toLowerCase()
if (flags.port) { cfg.port = flags.port }

const COMMANDS = {
  start: cmdStart, serve: cmdServe, ui: cmdUi, bridge: cmdServe,
  open: cmdOpen, app: cmdApp, publish: cmdPublish, upload: cmdPublish,
  ask: cmdAsk, status: cmdStatus, doctor: cmdDoctor, models: cmdModels,
  auth: cmdAuth, token: cmdToken, update: cmdUpdate, uninstall: cmdUninstall,
  help: () => console.log(HELP), '--help': () => console.log(HELP),
  version: () => console.log(PKG.version), '--version': () => console.log(PKG.version), '-v': () => console.log(PKG.version),
}

const fn = COMMANDS[cmd] || (() => { console.error(RED(`  unknown command: ${cmd}`)); console.log(HELP); process.exit(1) })
try { await fn(rest, flags) } catch (e) { die(e.message) }
