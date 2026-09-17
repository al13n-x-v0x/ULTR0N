/**
 * Morning Briefing — on first boot of the day the assistant greets you, recaps
 * what it holds in memory, reads the machine state and offers a proactive
 * suggestion. Manual any time via /briefing.
 */
import { useMemory } from '../store/memoryStore'
import { useData } from '../store/dataStore'
import { useSettings } from '../store/settingsStore'
import { selfKnowledgeBrief, activeEngineLabel } from './selfKnowledge'
import { listReminders } from './reminders'

const BRIEF_KEY = 'ultron.lastBriefing.v1'

function shouldAutoBrief(): boolean {
  try {
    const last = localStorage.getItem(BRIEF_KEY)
    const today = new Date().toDateString()
    return last !== today
  } catch { return true }
}

function markBriefed(): void {
  try { localStorage.setItem(BRIEF_KEY, new Date().toDateString()) } catch { /* noop */ }
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function suggestion(): string {
  const hour = new Date().getHours()
  const { settings } = useSettings.getState()
  if (settings.provider === 'local' && !settings.webllmModel) return 'Run /setup to install an on-device model — then I think for myself, offline.'
  if (hour < 11) return 'Deep-work window: say "focus mode on" tasks or just start — I am here.'
  if (hour >= 17) return 'Good hour to review: ask me what shipped today.'
  return 'Ask me anything, or /urx help to see the commands.'
}

/** Build the full briefing text (shared by auto-boot and /briefing). */
export function buildBriefing(): string {
  const name = useSettings.getState().settings.displayName || 'Operator'
  const memories = useMemory.getState().memories
  const metrics = useData.getState().metrics
  const pending = listReminders().filter((r) => r.armed && !r.firedAt)

  const lines: string[] = []
  lines.push(`**${greeting()}, ${name} — your briefing.**`)
  lines.push(`Time: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Engine: ${activeEngineLabel(useSettings.getState().settings)}`)

  if (memories.length > 0) {
    const last = memories.slice(0, 3).map((m) => `"${m.text}"`).join(', ')
    lines.push(`What I remember: ${last}${memories.length > 3 ? ` — and ${memories.length - 3} more` : ''}.`)
  } else {
    lines.push('Memory: nothing yet — tell me facts and I will hold them (say "remember that …").')
  }

  if (pending.length > 0) {
    lines.push(`Pending reminders: ${pending.map((r) => `"${r.text}"`).join(', ')}.`)
  }

  lines.push(`Machine: ${metrics.cpu}% CPU · ${metrics.ram}% RAM · ${metrics.disk}% disk — ${navigator.onLine ? 'online' : 'offline'}.`)
  lines.push(`Suggestion: ${suggestion()}`)
  return lines.join('\n')
}

/** Fire the briefing once per day at boot. Returns the text when fired. */
export function maybeBriefOnBoot(): string | null {
  if (!shouldAutoBrief()) return null
  markBriefed()
  return buildBriefing()
}

export { selfKnowledgeBrief }
