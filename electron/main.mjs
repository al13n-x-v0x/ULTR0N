/**
 * U.L.T.R.0.N. Desktop — Electron shell.
 * Loads the built web app and spawns the local bridge automatically,
 * so laptop control + YouTube uploads work with zero manual steps.
 *
 * Env passthrough: ULTRON_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 * FFMPEG_PATH — set them in the environment before launching; both the
 * bridge and the renderer inherit them.
 */
import { app, BrowserWindow, shell } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !!process.env.VITE_DEV_SERVER_URL
const BRIDGE_PORT = 8765

let bridgeProc = null
let win = null

function bridgeAvailable() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${BRIDGE_PORT}/health`, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1200, () => { req.destroy(); resolve(false) })
  })
}

async function startBridge() {
  if (await bridgeAvailable()) {
    console.log('[ultron] bridge already running on', BRIDGE_PORT)
    return
  }
  // Packaged: bridge ships as an extra resource. Dev: run from source.
  const bridgeScript = app.isPackaged
    ? path.join(process.resourcesPath, 'bridge', 'ultron-bridge.mjs')
    : path.join(__dirname, '..', 'bridge', 'ultron-bridge.mjs')
  bridgeProc = spawn(process.execPath, [bridgeScript], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  bridgeProc.stdout.on('data', (d) => console.log('[bridge]', String(d).trim()))
  bridgeProc.stderr.on('data', (d) => console.error('[bridge]', String(d).trim()))
  bridgeProc.on('exit', (code) => console.log('[bridge] exited', code))
  // wait for the health endpoint
  for (let i = 0; i < 20; i++) {
    if (await bridgeAvailable()) { console.log('[ultron] bridge started'); return }
    await new Promise((r) => setTimeout(r, 300))
  }
  console.error('[ultron] bridge did not become healthy — continuing without it')
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#05070c',
    title: 'U.L.T.R.0.N.',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // WebGPU needs this on some drivers:
      webgl: true,
      backgroundThrottling: false,
    },
  })

  // file:// pages are treated as a unique origin — relax CORS so the renderer
  // can reach localhost APIs (the bridge) and remote endpoints.
  if (!isDev) {
    win.webContents.session.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*'],
        },
      })
    })
  }

  // WebGPU for the on-device model
  win.webContents.on('did-finish-load', () => win?.setTitle('U.L.T.R.0.N. — AL13N INDUSTRIES'))
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url) // OAuth approvals open in the real browser
    return { action: 'deny' }
  })

  if (isDev) win.loadURL(isDev)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(async () => {
  app.commandLine.appendSwitch('enable-unsafe-webgpu')
  app.commandLine.appendSwitch('enable-features', 'Vulkan')
  await startBridge()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  if (bridgeProc) { try { bridgeProc.kill() } catch { /* noop */ } }
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => { if (bridgeProc) { try { bridgeProc.kill() } catch { /* noop */ } } })
