/* U.L.T.R.0.N. — shared type definitions */

export type AiState =
  | 'idle' | 'listening' | 'thinking' | 'processing' | 'responding'
  | 'executing' | 'success' | 'warning' | 'error' | 'offline'

export type Mode =
  | 'auto' | 'reason' | 'research' | 'vision' | 'code'
  | 'create' | 'plan' | 'focus' | 'study' | 'developer'

export type RightDock = 'open' | 'closed'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  ts: number
  kind?: 'info' | 'error' | 'pending'
  /** Which engine produced an assistant reply — e.g. "Qwen 2.5 · 1.5B · on-device". */
  model?: string
}

export interface Attachment {
  id: string
  name: string
  kind: string
  size: number
  /** Extracted text content for text-like files — included in AI context. */
  text?: string
}

export type DeviceStatus = 'connected' | 'paired' | 'nearby' | 'unknown'

export interface Device {
  id: string
  name: string
  kind: string
  icon: string
  status: DeviceStatus
  detail?: string
}

export type NotifKind = 'device' | 'task' | 'automation' | 'download' | 'warning' | 'message' | 'system'

export interface Notif {
  id: string
  ts: number
  read: boolean
  kind: NotifKind
  title: string
  body?: string
}

export interface Automation {
  id: string
  name: string
  trigger: string
  action: string
  enabled: boolean
  running: boolean
}

export interface Project {
  id: string
  name: string
  desc: string
  status: 'active' | 'paused' | 'done'
  progress: number
  tags: string[]
  created: number
}

export interface ViewFile {
  id: string
  name: string
  kind: string
  size: string
  ts: number
  /** Absolute laptop path — set when the bridge can reach the file for upload. */
  path?: string
}

/* ---------------- Publish queue (Files view → YouTube via bridge) ---------------- */

export type PublishStatus = 'draft' | 'writing' | 'ready' | 'uploading' | 'done' | 'error'

export interface PublishItem {
  id: string
  /** File name as shown in the workspace list. */
  fileName: string
  /** Absolute laptop path the bridge will upload from. */
  path: string
  topic: string
  privacy: 'public' | 'unlisted' | 'private'
  status: PublishStatus
  /** AI-generated copy — previewed before send. */
  hook?: string
  caption?: string
  hashtags?: string[]
  /** Caption/subtitle options chosen before upload. */
  burnCaptions?: boolean
  srt?: string
  spokenCaption?: string
  captionNote?: string
  /** Thumbnail suggestions generated from the hook. */
  thumbIdeas?: string[]
  error?: string
  videoId?: string
  ts: number
}

export type Accent = 'cyan' | 'blue' | 'violet' | 'emerald'

export type ProviderKind = 'local' | 'webllm' | 'remote'

export interface Settings {
  provider: ProviderKind
  webllmModel: string
  setupDone: boolean
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  /** Auto-detect ULX commands from natural prompts ("use qwen coder", "remember that…"). */
  autoBuff: boolean
  /** Custom persona note appended to the system prompt (buff layer). */
  buffPersona: string
  /** Show the holographic avatar instead of the abstract core. */
  avatarMode: boolean
  /** Local bridge token for laptop control (matches ULTRON_TOKEN). */
  bridgeToken: string
  uiSounds: boolean
  voiceReply: boolean
  speechRate: number
  ttsVoice: string
  wakeWord: boolean
  whisper: boolean
  focusMode: boolean
  motion: boolean
  glass: boolean
  accent: Accent
  density: 'comfortable' | 'compact'
  fontScale: number
  autoMemorize: boolean
  telemetry: boolean
  deviceDiscovery: boolean
  notifSystem: boolean
  notifDevices: boolean
  notifTasks: boolean
  displayName: string
  compactSidebar: boolean
  reducedEffects: boolean
}
