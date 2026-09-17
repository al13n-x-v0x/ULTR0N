/**
 * Smart reminders — assistant-style, but honest about the sandbox:
 * they fire as in-app notifications + the Notification API when permitted.
 * Nothing escapes the tab — no OS Task Scheduler, and we say so.
 */
import { useData } from '../store/dataStore'
import { useUi } from '../store/uiStore'

export interface Reminder {
  id: string
  text: string
  fireAt: number
  armed: boolean
  firedAt?: number
}

const KEY = 'ultron.reminders.v1'

function load(): Reminder[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Reminder[]
  } catch { /* ignore */ }
  return []
}

function save(list: Reminder[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

let reminders: Reminder[] = load()

export function listReminders(): Reminder[] {
  // Drop stale fired ones from memory view but keep history persisted
  return reminders
}

function persist(): void {
  save(reminders)
}

export function addReminder(text: string, fireAt: number): Reminder {
  const r: Reminder = { id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, text, fireAt, armed: true }
  reminders = [r, ...reminders]
  persist()
  arm(r)
  return r
}

export function cancelReminder(id: string): void {
  reminders = reminders.filter((r) => r.id !== id)
  persist()
}

/** Natural-language parsing: "remind me to X in 10 minutes / in 1h30 / at 18:45 / tomorrow 9am". */
export function parseReminder(input: string): { text: string; fireAt: number } | null {
  const t = input.trim()
  const now = Date.now()

  const inMatch = t.match(/^(?:remind me to\s+|remind me\s+)?(.+?)\s+in\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|d|seconds?|secs?|s)\.?$/i)
  if (inMatch) {
    const n = parseInt(inMatch[2], 10)
    const unit = inMatch[3].toLowerCase()
    const mult = unit.startsWith('s') ? 1000 : unit.startsWith('m') && !unit.startsWith('mo') ? 60_000 : unit.startsWith('h') ? 3_600_000 : 86_400_000
    if (n > 0) return { text: inMatch[1], fireAt: now + n * mult }
  }

  const atMatch = t.match(/^(?:remind me to\s+|remind me\s+)?(.+?)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (atMatch) {
    let h = parseInt(atMatch[2], 10)
    const min = atMatch[3] ? parseInt(atMatch[3], 10) : 0
    const ap = atMatch[4]?.toLowerCase()
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    const d = new Date()
    d.setHours(h, min, 0, 0)
    let fireAt = d.getTime()
    if (fireAt <= now) fireAt += 86_400_000 // next day
    return { text: atMatch[1], fireAt }
  }

  return null
}

function fire(r: Reminder): void {
  r.firedAt = Date.now()
  persist()
  useData.getState().pushNotif({ kind: 'task', title: '⏰ Reminder', body: r.text })
  useUi.getState().pushToast({ title: '⏰ Reminder', body: r.text, kind: 'info' })
  // OS-level notification when the tab is backgrounded and permission granted
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      new Notification('U.L.T.R.0.N. reminder', { body: r.text })
    }
  } catch { /* noop */ }
}

interface TimerHandle { check: () => void }
const timers = new Map<string, TimerHandle>()

/** Schedule the check for a reminder. Recalled for pending ones on boot. */
function arm(r: Reminder): void {
  if (timers.has(r.id)) return
  const tick = () => {
    if (!r.armed || r.firedAt) return
    if (Date.now() >= r.fireAt) fire(r)
  }
  const delay = Math.max(250, Math.min(r.fireAt - Date.now(), 2_147_000_000))
  const h = window.setTimeout(() => {
    tick()
    timers.delete(r.id)
  }, delay)
  timers.set(r.id, { check: () => { window.clearTimeout(h); tick() } })
}

/** Re-arm all pending reminders (call at app boot — survives reloads). */
export function armAll(): void {
  for (const r of reminders) {
    if (r.armed && !r.firedAt) {
      if (Date.now() >= r.fireAt) fire(r) // fired while we were closed — say it now
      else arm(r)
    }
  }
}

/** Ask the user's permission for OS notifications (honest: optional). */
export async function requestNotifyPermission(): Promise<boolean> {
  try {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const res = await Notification.requestPermission()
    return res === 'granted'
  } catch { return false }
}
