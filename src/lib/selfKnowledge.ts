/**
 * Runtime self-knowledge — the Mark-LIV idea: the assistant knows what it is,
 * what machine it runs on, what it can do and what it CANNOT do — assembled
 * from the live system, not from a prompt that goes stale.
 *
 * The brief version is injected into every AI system prompt; the full version
 * powers /urx sys and /diagnostics.
 */
import type { Settings } from '../types'

let gpuAdapterName: string | null = null

/** Called by probeHardware() once a real adapter is revealed. */
export function setGpuAdapter(name: string | null): void {
  gpuAdapterName = name
}

export function activeEngineLabel(settings: Settings): string {
  if (settings.provider === 'webllm' && settings.webllmModel) return `${settings.webllmModel} (on-device, WebGPU)`
  if (settings.provider === 'remote' && settings.apiKey.trim()) return `remote API · ${settings.model}`
  return 'light heuristic core (no model installed)'
}

function machineLine(): string {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const threads = navigator.hardwareConcurrency ?? '?'
  const ram = typeof nav.deviceMemory === 'number' ? `~${nav.deviceMemory}GB RAM` : 'RAM hidden by browser'
  const gpu = gpuAdapterName ?? ('gpu' in navigator ? 'WebGPU adapter (unnamed)' : 'no WebGPU')
  return `${threads} threads · ${ram} · ${gpu}`
}

function canList(): string[] {
  const can: string[] = ['chat and reason', 'write and review code', 'store/recall long-term memories', 'set real reminders']
  if ('speechSynthesis' in window) can.push('speak replies aloud')
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) can.push('hear you (in-app mic)')
  if (typeof navigator.mediaDevices?.getUserMedia === 'function') can.push('see via camera or screen-share — only when you open it')
  if ('serviceWorker' in navigator || 'caches' in window) can.push('run an on-device model fully offline once downloaded')
  return can
}

function cannotList(): string[] {
  return [
    'control your OS — no launching apps, no clicking, no system settings',
    'run anything outside this browser tab, or act while it is closed',
    'read files you have not attached or pasted',
    'confirm irreversible actions by itself — it asks you first',
  ]
}

/** Compact block injected into the system prompt (kept small for on-device models). */
export function selfKnowledgeBrief(settings: Settings): string {
  return [
    'SELF-KNOWLEDGE (assembled live at session start):',
    `You are U.L.T.R.0.N. running in the U.L.T.R.0.N. web shell on this machine (${machineLine()}). Active engine: ${activeEngineLabel(settings)}.`,
    `You can: ${canList().join('; ')}.`,
    `You cannot: ${cannotList().join('; ')}. State limits plainly instead of improvising.`,
  ].join('\n')
}

/** Detailed, human-readable report for /urx sys and /diagnostics. */
export function selfKnowledgeFull(settings: Settings): string {
  return [
    '**Self-knowledge — assembled from the live system**',
    `• Identity: U.L.T.R.0.N. (Unified Logic, Tactical Reasoning & Zero-Point Network) by AL13N INDUSTRIES`,
    `• Machine: ${machineLine()}`,
    `• Platform: ${navigator.platform}`,
    `• Engine: ${activeEngineLabel(settings)}`,
    `• Network: ${navigator.onLine ? 'online' : 'offline — on-device model still works if installed'}`,
    '',
    '**What I can do right now**',
    ...canList().map((c) => `• ${c}`),
    '',
    '**What I cannot do — stated plainly**',
    ...cannotList().map((c) => `• ${c}`),
    '',
    'When you ask for something outside these walls, I will say so instead of pretending.',
  ].join('\n')
}
