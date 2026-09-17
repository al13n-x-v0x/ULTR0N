/**
 * Bridge client — talks to the local companion (bridge/ultron-bridge.mjs).
 * The web app discovers it on localhost:8765; every write action is token-gated
 * and the bridge logs what happened. All of this is REAL: opening sites/apps,
 * running confirmed commands, uploading to YouTube.
 */
import { useData } from '../store/dataStore'

export interface BridgeHealth {
  ok: boolean
  service?: string
  version?: number
  commandsEnabled?: boolean
  youtubeConfigured?: boolean
  /** ffmpeg available on the laptop — required for caption burning. */
  ffmpeg?: boolean
  platform?: string
  error?: string
}

const BASE = 'http://localhost:8765'
let token = ''
try { token = localStorage.getItem('ultron.bridgeToken') ?? '' } catch { /* noop */ }

export function setBridgeToken(t: string): void {
  token = t.trim()
  try { localStorage.setItem('ultron.bridgeToken', token) } catch { /* noop */ }
}
export function hasBridgeToken(): boolean {
  return token.length > 0
}

async function call(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Ultron-Token': token, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout ? AbortSignal.timeout(60_000) : undefined,
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

export async function bridgeHealth(): Promise<BridgeHealth> {
  try {
    const { status, body } = await call('/health')
    if (status === 200) return body as BridgeHealth
    return { ok: false, error: `HTTP ${status}` }
  } catch (e) {
    return { ok: false, error: 'bridge not reachable (node bridge/ultron-bridge.mjs)' }
  }
}

function logAction(action: string, detail?: string): void {
  useData.getState().pushNotif({ kind: 'task', title: `⚡ ${action}`, body: detail ?? 'Bridge executed the action.' })
}

/** Open a URL (YouTube, Instagram, anything) in the user's real browser. */
export async function bridgeOpenUrl(url: string): Promise<string> {
  const { status, body } = await call('/open', { method: 'POST', body: JSON.stringify({ url }) })
  if (status === 200 && body.ok) { logAction('Opened on your laptop', url); return `Opened ${url} on your laptop.` }
  return `Could not open: ${body.error ?? `HTTP ${status}`}`
}

/** Launch a known app (notepad, calc, terminal…). */
export async function bridgeOpenApp(app: string): Promise<string> {
  const { status, body } = await call('/open', { method: 'POST', body: JSON.stringify({ app }) })
  if (status === 200 && body.ok) { logAction('Launched app', app); return `Launched ${app}.` }
  return `App launch failed: ${body.error ?? `HTTP ${status}`}`
}

/** Run a shell command on the laptop (requires token). */
export async function bridgeExec(command: string): Promise<string> {
  const { status, body } = await call('/exec', { method: 'POST', body: JSON.stringify({ command }) })
  if (status === 200) {
    const out = [body.stdout, body.stderr].filter(Boolean).join('\n').trim()
    logAction('Ran command', command)
    return out ? `$ ${command}\n${out.slice(0, 1500)}` : `$ ${command}\n(done, no output)`
  }
  return `Exec failed: ${body.error ?? `HTTP ${status}`}`
}

/** Start a YouTube upload of a local file. Returns a job id. */
export async function bridgeYoutubeUpload(filePath: string, meta: { title: string; description?: string; tags?: string[]; privacy?: 'public' | 'unlisted' | 'private'; mimeType?: string; thumbnailDataUrl?: string }): Promise<string> {
  const { status, body } = await call('/youtube/upload', { method: 'POST', body: JSON.stringify({ path: filePath, ...meta }) })
  if (status === 200 && body.ok) { logAction('YouTube upload started', meta.title); return body.jobId }
  throw new Error(body.error ?? `HTTP ${status}`)
}

export async function bridgeYoutubeJob(id: string): Promise<{ status: string; videoId?: string; error?: string } | null> {
  const { body } = await call(`/youtube/job?id=${encodeURIComponent(id)}`)
  return body.job ?? null
}

/** Open Google OAuth in a new tab to authorize uploads. */
export async function bridgeYoutubeAuth(): Promise<string> {
  const { status, body } = await call('/youtube/auth')
  if (status === 302 || status === 200) {
    if (typeof window !== 'undefined') window.open(`${BASE}/youtube/auth`, '_blank')
    return 'Google authorization opened in a new tab — approve and come back.'
  }
  return `Auth failed: ${body.error ?? `HTTP ${status}`}`
}

/** Burn an .srt onto a video via the bridge's ffmpeg. Returns the new file path. */
export async function bridgeBurnSubtitles(videoPath: string, srt: string): Promise<string> {
  const { status, body } = await call('/subtitles/burn', {
    method: 'POST',
    body: JSON.stringify({ videoPath, srt }),
  })
  if (status === 200 && body.ok) return body.output as string
  throw new Error(body.error ?? `HTTP ${status}`)
}

/**
 * Render a YouTube-ready 1280×720 thumbnail PNG in the browser (canvas) from a
 * short text idea — big bold uppercase type on the shell's hologram gradient.
 * Returns a data URL; the bridge strips the prefix and PUTs it to YouTube.
 */
export async function makeThumbnailDataUrl(text: string): Promise<string> {
  const W = 1280, H = 720
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable for thumbnail rendering')

  // backdrop: dark hologram gradient + glow accents
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0b1120')
  bg.addColorStop(0.55, '#0e1a33')
  bg.addColorStop(1, '#123a52')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // grid lines — the shell's hologram language
  ctx.strokeStyle = 'rgba(34,211,238,0.09)'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // glow orb
  const orb = ctx.createRadialGradient(W - 180, 140, 10, W - 180, 140, 320)
  orb.addColorStop(0, 'rgba(34,211,238,0.35)')
  orb.addColorStop(1, 'rgba(34,211,238,0)')
  ctx.fillStyle = orb
  ctx.fillRect(0, 0, W, H)

  // frame border
  ctx.strokeStyle = 'rgba(34,211,238,0.55)'
  ctx.lineWidth = 6
  ctx.strokeRect(14, 14, W - 28, H - 28)

  // brand tag
  ctx.fillStyle = 'rgba(154,232,255,0.85)'
  ctx.font = '600 30px "Segoe UI", system-ui, sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText('U.L.T.R.0.N.', 48, 44)

  // the big hook text — wrapped, auto-fit
  const words = (text || 'WATCH THIS').toUpperCase().split(/\s+/)
  let size = 148
  let lines: string[] = []
  ctx.textAlign = 'center'
  while (size >= 54) {
    ctx.font = `800 ${size}px "Arial Black", "Segoe UI", system-ui, sans-serif`
    lines = []
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width > W - 160) { if (line) lines.push(line); line = w } else line = test
    }
    if (line) lines.push(line)
    if (lines.length <= 3) break
    size -= 12
  }
  const lineH = size * 1.08
  const y0 = H / 2 - (lines.length * lineH) / 2
  lines.forEach((ln, i) => {
    const y = y0 + i * lineH + lineH / 2
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillText(ln, W / 2 + 5, y + 5)
    ctx.fillStyle = '#eaf6ff'
    ctx.fillText(ln, W / 2, y)
  })

  return canvas.toDataURL('image/png')
}
