import { create } from 'zustand'
import type { Settings } from '../types'

const KEY = 'ultron.settings.v1'

const defaults: Settings = {
  provider: 'local',
  webllmModel: '',
  setupDone: false,
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 1200,
  autoBuff: true,
  buffPersona: '',
  avatarMode: true,
  bridgeToken: '',
  uiSounds: false,
  voiceReply: false,
  speechRate: 1,
  ttsVoice: '',
  wakeWord: false,
  whisper: false,
  focusMode: false,
  motion: true,
  glass: true,
  accent: 'cyan',
  density: 'comfortable',
  fontScale: 1,
  autoMemorize: true,
  telemetry: false,
  deviceDiscovery: false,
  notifSystem: true,
  notifDevices: true,
  notifTasks: true,
  displayName: 'AL13N',
  compactSidebar: false,
  reducedEffects: false,
}

export interface SettingsState {
  settings: Settings
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  reset: () => void
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...defaults }
}

export const useSettings = create<SettingsState>()((set, get) => ({
  settings: load(),
  set: (key, value) => {
    set({ settings: { ...get().settings, [key]: value } })
    try { localStorage.setItem(KEY, JSON.stringify(get().settings)) } catch { /* ignore */ }
  },
  reset: () => {
    set({ settings: { ...defaults } })
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  },
}))

export function getAiSettings() {
  return useSettings.getState().settings
}
