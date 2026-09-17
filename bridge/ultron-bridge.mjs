#!/usr/bin/env node
/**
 * U.L.T.R.0.N. Bridge — the optional local companion that gives the web shell
 * REAL laptop control, the same role Mark-LIV's Python core plays:
 *   • open any URL or app          • run shell commands (token-gated, logged)
 *   • real YouTube uploads         • screenshot listing / open files
 *
 * Run:   node bridge/ultron-bridge.mjs          (http://localhost:8765)
 * Setup: set ULTRON_TOKEN=any-long-secret  (the web app asks for the same token)
 * YouTube: set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET from
 *          https://console.cloud.google.com (YouTube Data API v3 enabled)
 *
 * Zero dependencies — Node 18+ stdlib only.
 */
import http from 'node:http'
import { spawn, exec, execFile } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Duplex, PassThrough } from 'node:stream'

const PORT = process.env.ULTRON_PORT || 8765
const TOKEN = process.env.ULTRON_TOKEN || ''
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI = `http://localhost:${PORT}/oauth2/callback`

const sessions = new Map() // state -> { resolve, startedAt }
const uploadJobs = new Map() // id -> { status, videoId?, error? }

function ffmpegPath() {
  return process.env.FFMPEG_PATH || 'ffmpeg'
}

function hasFfmpeg() {
  return new Promise((resolve) => {
    execFile(ffmpegPath(), ['-version'], { windowsHide: true }, (err) => resolve(!err))
  })
}

/**
 * Burn an .srt onto the video (soft subs, bottom band). One ffmpeg pass.
 * escapePath follows the ffmpeg subtitle filter's escaping rules.
 */
function burnSubtitles(videoPath, srtPath, outPath) {
  return new Promise((resolve) => {
    const esc = videoPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\\"")
    const vf = `subtitles='${esc}':force_style='FontName=Arial,FontSize=17,Outline=1,Shadow=1,MarginV=28'`
    execFile(ffmpegPath(), ['-y', '-i', videoPath, '-vf', vf, '-c:a', 'copy', outPath],
      { windowsHide: true, timeout: 30 * 60_000 }, (err, stdout, stderr) => {
        if (err) return resolve({ ok: false, error: String(stderr || err.message).slice(-500) })
        resolve({ ok: true, output: outPath, bytes: fs.statSync(outPath).size })
      })
  })
}

if (!TOKEN) {
  console.log('⚠ No ULTRON_TOKEN set — command execution is DISABLED (open-url still works).')
  console.log('  Set one:  ULTRON_TOKEN=my-secret node bridge/ultron-bridge.mjs')
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(obj))
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
  })
}

function requireToken(req) {
  const t = req.headers['x-ultron-token'] || new URL(req.url, 'http://x').searchParams.get('token') || ''
  if (!TOKEN) return { ok: false, why: 'Bridge started without ULTRON_TOKEN — command execution disabled.' }
  if (t !== TOKEN) return { ok: false, why: 'Bad or missing token.' }
  return { ok: true }
}

function openUrl(url) {
  const plat = process.platform
  if (plat === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref()
  else if (plat === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref()
  else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref()
}

function openApp(app) {
  // conservative launchers; unknown apps return an error rather than guessing
  const map = {
    win32: { notepad: 'notepad', calc: 'calc', explorer: 'explorer', terminal: 'cmd', paint: 'mspaint' },
    darwin: { notes: 'Notes', calculator: 'Calculator', terminal: 'Terminal', safari: 'Safari', finder: 'Finder' },
    linux: { terminal: 'x-terminal-emulator', files: 'nautilus', calculator: 'gnome-calculator' },
  }
  const cmd = map[process.platform]?.[app.toLowerCase()]
  if (!cmd) return { ok: false, error: `Unknown app "${app}" for ${process.platform}. Known: ${Object.keys(map[process.platform] || {}).join(', ')}` }
  if (process.platform === 'win32') exec(`start "" ${cmd}`)
  else if (process.platform === 'darwin') spawn('open', ['-a', cmd], { detached: true }).unref()
  else spawn(cmd, [], { detached: true }).unref()
  return { ok: true }
}

/* ------------------------- YouTube OAuth ------------------------- */

function oauthStart(res) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return json(res, 500, { ok: false, error: 'Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars to enable YouTube uploads.' })
  }
  const state = crypto.randomBytes(16).toString('hex')
  sessions.set(state, { startedAt: Date.now() })
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  auth.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  auth.searchParams.set('redirect_uri', REDIRECT_URI)
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly')
  auth.searchParams.set('access_type', 'offline')
  auth.searchParams.set('prompt', 'consent')
  auth.searchParams.set('state', state)
  res.writeHead(302, { Location: auth.toString() })
  res.end()
}

async function oauthCallback(req, res) {
  const u = new URL(req.url, 'http://x')
  const code = u.searchParams.get('code')
  const state = u.searchParams.get('state')
  if (!code || !state || !sessions.has(state)) return json(res, 400, { ok: false, error: 'Bad OAuth callback' })
  sessions.delete(state)
  try {
    const body = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    })
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body })
    const tok = await r.json()
    if (!tok.refresh_token) {
      // fall back: access token works for this session; ask user to re-consent next time
    }
    tokens.youtube = tok
    json(res, 200, { ok: true, message: 'YouTube authorized. You can close this tab.' })
  } catch (e) {
    json(res, 500, { ok: false, error: String(e) })
  }
}

const tokens = { youtube: null }

/**
 * Set a custom YouTube thumbnail (needs a verified channel for customs).
 * Accepts a data URL or an https URL — YouTube's thumbnail/set endpoint wants
 * raw image bytes, so https sources are fetched first.
 */
async function setThumbnail(videoId, thumbnailDataUrl) {
  try {
    const at = await youtubeAccessToken()
    let bytes
    if (thumbnailDataUrl.startsWith('data:')) {
      const b64 = thumbnailDataUrl.slice(thumbnailDataUrl.indexOf(',') + 1)
      bytes = Buffer.from(b64, 'base64')
    } else if (/^https?:\/\//i.test(thumbnailDataUrl)) {
      const img = await fetch(thumbnailDataUrl)
      bytes = Buffer.from(await img.arrayBuffer())
    } else {
      bytes = Buffer.from(thumbnailDataUrl, 'utf8')
    }
    const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnail/set?videoId=${encodeURIComponent(videoId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'image/png', 'Content-Length': bytes.length },
      body: bytes,
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`thumbnail/set ${r.status}: ${JSON.stringify(j).slice(0, 200)}`)
    console.log(`  ✓ thumbnail set for ${videoId}`)
    return true
  } catch (e) {
    console.log(`  thumbnail note: ${String(e.message || e).slice(0, 300)}`)
    return false
  }
}

async function youtubeAccessToken() {
  if (!tokens.youtube) throw new Error('Not authorized — run /urx skill run youtube.auth first.')
  if (tokens.youtube.refresh_token) {
    const body = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.youtube.refresh_token, grant_type: 'refresh_token',
    })
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body })
    const j = await r.json()
    if (j.access_token) tokens.youtube.access_token = j.access_token
  }
  return tokens.youtube.access_token
}

/* ------------------------- Resumable upload ------------------------- */

async function youtubeUpload(filePath, meta) {
  const id = crypto.randomBytes(6).toString('hex')
  uploadJobs.set(id, { status: 'starting' })
  ;(async () => {
    try {
      const at = await youtubeAccessToken()
      const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${at}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': meta.size,
          'X-Upload-Content-Type': meta.mimeType || 'video/mp4',
        },
        body: JSON.stringify({
          snippet: { title: meta.title, description: meta.description || '', tags: meta.tags || [], categoryId: meta.categoryId || '22' },
          status: { privacyStatus: meta.privacy || 'unlisted', selfDeclaredMadeForKids: false },
        }),
      })
      const uploadUrl = init.headers.get('location')
      if (!uploadUrl) throw new Error(`Upload init failed: ${init.status} ${await init.text().catch(() => '')}`.slice(0, 200))
      uploadJobs.set(id, { status: 'uploading' })

      const stat = await fs.promises.stat(filePath)
      const stream = fs.createReadStream(filePath)
      // Node fetch needs a web stream for body
      const webStream = stream.pipe(new PassThrough())
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Length': stat.size, 'Content-Type': meta.mimeType || 'video/mp4' },
        body: webStream,
        // @ts-ignore - duplex is needed for streaming bodies in undici
        duplex: 'half',
      }).then(async (r) => {
      const j = await r.json().catch(() => ({}))
      if (r.ok && j.id) {
        uploadJobs.set(id, { status: 'done', videoId: j.id })
        if (meta.thumbnailDataUrl) {
          setThumbnail(j.id, meta.thumbnailDataUrl).catch((e) => console.log('  thumbnail set failed:', String(e).slice(0, 200)))
        }
      } else {
        uploadJobs.set(id, { status: 'error', error: JSON.stringify(j).slice(0, 300) })
      }
      })
    } catch (e) {
      uploadJobs.set(id, { status: 'error', error: String(e).slice(0, 300) })
    }
  })()
  return id
}

/* ------------------------- HTTP server ------------------------- */

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`)
  const p = u.pathname
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Ultron-Token', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end() }
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v)

  if (p === '/health') return json(res, 200, { ok: true, service: 'ultron-bridge', version: 3, commandsEnabled: !!TOKEN, youtubeConfigured: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET), ffmpeg: await hasFfmpeg(), platform: process.platform })

  if (p === '/oauth2/callback') return oauthCallback(req, res)
  if (p === '/youtube/auth') return oauthStart(res)

  const gate = requireToken(req)
  if (!gate.ok) return json(res, 401, { ok: false, error: gate.why })

  if (req.method === 'POST' && p === '/open') {
    const { url, app } = JSON.parse(await readBody(req) || '{}')
    if (app) {
      const r = openApp(app)
      return json(res, r.ok ? 200 : 400, { ...r, action: `open app ${app}` })
    }
    if (!/^https?:\/\//i.test(url || '')) return json(res, 400, { ok: false, error: 'Only http(s) URLs.' })
    openUrl(url)
    return json(res, 200, { ok: true, action: `open ${url}` })
  }

  if (req.method === 'POST' && p === '/exec') {
    const { command } = JSON.parse(await readBody(req) || '{}')
    if (!command || typeof command !== 'string') return json(res, 400, { ok: false, error: 'command required' })
    const child = exec(command, { timeout: 30_000, windowsHide: true }, (err, stdout, stderr) => {
      json(res, 200, { ok: !err, stdout: String(stdout).slice(0, 4000), stderr: String(stderr).slice(0, 4000), error: err?.message })
    })
    child.on('error', () => {})
    return
  }

  if (req.method === 'POST' && p === '/youtube/upload') {
    const body = JSON.parse(await readBody(req) || '{}')
    if (!body.path || !body.title) return json(res, 400, { ok: false, error: 'path and title required' })
    const abs = path.resolve(body.path.replace(/^~(?=$|\/|\\)/, os.homedir()))
    try { await fs.promises.access(abs) } catch { return json(res, 404, { ok: false, error: `File not found: ${abs}` }) }
    const stat = await fs.promises.stat(abs)
    const id = await youtubeUpload(abs, { ...body, size: stat.size })
    return json(res, 200, { ok: true, jobId: id, status: 'starting' })
  }

  if (req.method === 'POST' && p === '/subtitles/burn') {
    const body = JSON.parse(await readBody(req) || '{}')
    const { videoPath, srt } = body
    if (!videoPath || !srt) return json(res, 400, { ok: false, error: 'videoPath and srt required' })
    if (!(await hasFfmpeg())) return json(res, 500, { ok: false, error: 'ffmpeg not found — install it or set FFMPEG_PATH' })
    const abs = path.resolve(String(videoPath).replace(/^~(?=$|\/|\\)/, os.homedir()))
    try { await fs.promises.access(abs) } catch { return json(res, 404, { ok: false, error: `Video not found: ${abs}` }) }
    const srtFile = abs.replace(/\.\w+$/, '') + '.ultron.srt'
    const outFile = abs.replace(/\.\w+$/, '') + '.captioned' + (abs.match(/\.\w+$/)?.[0] ?? '.mp4')
    await fs.promises.writeFile(srtFile, String(srt), 'utf8')
    const r = await burnSubtitles(abs, srtFile, outFile)
    fs.promises.unlink(srtFile).catch(() => {})
    if (!r.ok) return json(res, 500, { ok: false, error: r.error })
    return json(res, 200, { ok: true, output: r.output, bytes: r.bytes })
  }

  if (req.method === 'GET' && p === '/youtube/job') {
    const job = uploadJobs.get(u.searchParams.get('id') || '')
    return json(res, 200, { ok: true, job: job ?? null })
  }

  return json(res, 404, { ok: false, error: 'unknown route' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n⚡ U.L.T.R.0.N. bridge on http://localhost:${PORT}`)
  console.log(`   commands: ${TOKEN ? 'ENABLED' : 'disabled (set ULTRON_TOKEN)'}`)
  console.log(`   youtube:  ${(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) ? 'configured' : 'not configured (set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)'}`)
  console.log('   Ctl+C to stop.\n')
})
