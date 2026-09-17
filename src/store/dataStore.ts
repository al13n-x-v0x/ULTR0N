import { create } from 'zustand'
import type { Automation, Device, Notif, Project, PublishItem, ViewFile } from '../types'
import { nextId } from '../lib/id'

export interface SystemMetrics {
  cpu: number
  ram: number
  disk: number
  gpu: number
  temp: number
  net: number
  uptime: string
  cores: { name: string; load: number }[]
  history: number[]
}

interface DataState {
  metrics: SystemMetrics
  devices: Device[]
  scanning: boolean
  scanLog: string[]
  notifs: Notif[]
  automations: Automation[]
  projects: Project[]
  files: ViewFile[]
  publishQueue: PublishItem[]
  memSearch: string
  addProject: (name: string) => Project
  removeProject: (id: string) => void
  toggleAutomation: (id: string) => void
  addAutomation: (name: string) => void
  removeAutomation: (id: string) => void
  pushNotif: (n: Omit<Notif, 'id' | 'ts' | 'read'>) => void
  markAllRead: () => void
  markRead: (id: string) => void
  clearNotifs: () => void
  setScanning: (s: boolean) => void
  setDevices: (d: Device[]) => void
  addFile: (f: Omit<ViewFile, 'id' | 'ts'>) => void
  removeFile: (id: string) => void
  updateFile: (id: string, patch: Partial<ViewFile>) => void
  setMemSearch: (s: string) => void
  addPublish: (p: Omit<PublishItem, 'id' | 'ts' | 'status'>) => PublishItem
  updatePublish: (id: string, patch: Partial<PublishItem>) => void
  removePublish: (id: string) => void
}

const seedNotifs: Notif[] = [
  { id: nextId(), ts: Date.now() - 1000 * 60 * 2, read: false, kind: 'system', title: 'U.L.T.R.0.N. core online', body: 'Local reasoning core initialized. All subsystems nominal.' },
  { id: nextId(), ts: Date.now() - 1000 * 60 * 9, read: false, kind: 'system', title: 'Keyboard shortcuts ready', body: 'Press Ctrl+K anywhere to open the command palette. Ctrl+/ for all shortcuts.' },
]

const seedAutomations: Automation[] = [
  { id: nextId(), name: 'Morning briefing', trigger: 'Daily 07:30', action: 'Summarize overnight messages + weather', enabled: true, running: false },
  { id: nextId(), name: 'Focus guard', trigger: 'Manual', action: 'Enable Focus mode, silence notifications', enabled: false, running: false },
  { id: nextId(), name: 'Backup workspace', trigger: 'Weekly · Fri 18:00', action: 'Archive /workspace to local vault', enabled: true, running: false },
]

const seedProjects: Project[] = [
  { id: nextId(), name: 'U.L.T.R.0.N. Shell', desc: 'Desktop assistant surface — UI, palette, device mesh', status: 'active', progress: 0.72, tags: ['ui', 'assistant'], created: Date.now() - 86400000 * 12 },
  { id: nextId(), name: 'Voice Stack', desc: 'Wake word + streaming speech pipeline', status: 'paused', progress: 0.35, tags: ['voice'], created: Date.now() - 86400000 * 30 },
  { id: nextId(), name: 'Zero-Point Net', desc: 'Local device mesh discovery protocol', status: 'active', progress: 0.5, tags: ['network', 'iot'], created: Date.now() - 86400000 * 5 },
]

const seedFiles: ViewFile[] = [
  { id: nextId(), name: 'ultron-manifest.md', kind: 'doc', size: '2.1 KB', ts: Date.now() - 3600_000 },
  { id: nextId(), name: 'device-mesh.ts', kind: 'code', size: '8.4 KB', ts: Date.now() - 7200_000 },
  { id: nextId(), name: 'keynote-outline.md', kind: 'doc', size: '1.0 KB', ts: Date.now() - 86400_000 },
]

// ---- Publish queue persistence (survives reloads; status resets to last known) ----
const PUBLISH_KEY = 'ultron.publish.v1'
function loadPublishQueue(): PublishItem[] {
  try {
    const raw = localStorage.getItem(PUBLISH_KEY)
    if (raw) return JSON.parse(raw) as PublishItem[]
  } catch { /* ignore */ }
  return []
}
function persistPublishQueue(q: PublishItem[]): void {
  try { localStorage.setItem(PUBLISH_KEY, JSON.stringify(q)) } catch { /* ignore */ }
}

const emptyMetrics: SystemMetrics = {
  cpu: 22, ram: 46, disk: 61, gpu: 12, temp: 44, net: 8,
  uptime: '0m',
  cores: Array.from({ length: 8 }, (_, i) => ({ name: `CPU${i}`, load: 0 })),
  history: Array.from({ length: 40 }, () => 0),
}

export const useData = create<DataState>()((set, get) => ({
  metrics: emptyMetrics,
  devices: [],
  scanning: false,
  scanLog: [],
  notifs: seedNotifs,
  automations: seedAutomations,
  projects: seedProjects,
  files: seedFiles,
  memSearch: '',

  addProject: (name) => {
    const p: Project = { id: nextId(), name, desc: 'New project — description pending.', status: 'active', progress: 0, tags: [], created: Date.now() }
    set({ projects: [p, ...get().projects] })
    return p
  },
  removeProject: (id) => set({ projects: get().projects.filter((p) => p.id !== id) }),
  toggleAutomation: (id) => set({ automations: get().automations.map((a) => (a.id === id ? { ...a, enabled: !a.enabled, running: false } : a)) }),
  addAutomation: (name) => set({ automations: [{ id: nextId(), name, trigger: 'Manual', action: 'Describe the action…', enabled: false, running: false }, ...get().automations] }),
  removeAutomation: (id) => set({ automations: get().automations.filter((a) => a.id !== id) }),

  pushNotif: (n) => set({ notifs: [{ id: nextId(), ts: Date.now(), read: false, ...n }, ...get().notifs].slice(0, 40) }),
  markAllRead: () => set({ notifs: get().notifs.map((n) => ({ ...n, read: true })) }),
  markRead: (id) => set({ notifs: get().notifs.map((n) => (n.id === id ? { ...n, read: true } : n)) }),
  clearNotifs: () => set({ notifs: [] }),

  setScanning: (s) => set({ scanning: s }),
  setDevices: (d) => set({ devices: d }),
  publishQueue: loadPublishQueue(),

  addFile: (f) => set({ files: [{ id: nextId(), ts: Date.now(), ...f }, ...get().files] }),
  removeFile: (id) => set({ files: get().files.filter((f) => f.id !== id) }),
  updateFile: (id, patch) => set({ files: get().files.map((f) => (f.id === id ? { ...f, ...patch } : f)) }),
  setMemSearch: (s) => set({ memSearch: s }),

  addPublish: (p) => {
    const item: PublishItem = { id: nextId(), ts: Date.now(), status: 'draft', ...p }
    set({ publishQueue: [item, ...get().publishQueue] })
    persistPublishQueue(get().publishQueue)
    return item
  },
  updatePublish: (id, patch) => {
    set({ publishQueue: get().publishQueue.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
    persistPublishQueue(get().publishQueue)
  },
  removePublish: (id) => {
    set({ publishQueue: get().publishQueue.filter((x) => x.id !== id) })
    persistPublishQueue(get().publishQueue)
  },
}))

// ---- Metrics simulation (updates the shared store; Home/SystemMonitor & Tools consume it) ----
let metricsTimer: number | null = null
let bootTime = Date.now()
let tick = 0

export function startMetrics() {
  if (metricsTimer !== null) return
  bootTime = Date.now()
  metricsTimer = window.setInterval(() => {
    tick++
    const s = useData.getState()
    const drift = (v: number, amt: number, min = 3, max = 97) => Math.max(min, Math.min(max, v + (Math.random() - 0.5) * amt))
    const cpu = drift(s.metrics.cpu, 9, 4, 92)
    const gpu = drift(s.metrics.gpu, 7, 2, 88)
    const ram = drift(s.metrics.ram, 2.2, 22, 88)
    const temp = drift(s.metrics.temp, 2.4, 34, 82)
    const net = drift(s.metrics.net, 14, 0, 100)
    const cores = s.metrics.cores.map((c) => ({ ...c, load: Math.max(2, Math.min(99, c.load + (Math.random() - 0.5) * 26)) }))
    const mins = Math.floor((Date.now() - bootTime) / 60000)
    const uptime = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
    useData.setState({
      metrics: {
        cpu, ram, disk: s.metrics.disk, gpu, temp, net,
        uptime,
        cores,
        history: [...s.metrics.history.slice(1), cpu],
      },
    })
    if (tick === 26) {
      s.pushNotif({ kind: 'system', title: 'Telemetry calibrated', body: 'System monitors are streaming live local telemetry.' })
    }
  }, 1600)
}

export function stopMetrics() {
  if (metricsTimer !== null) { clearInterval(metricsTimer); metricsTimer = null }
}
