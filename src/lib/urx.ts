/**
 * ULX — the U.L.T.R.0.N. Language eXtension.
 * A one-line command grammar that lets the buff layer steer the whole shell:
 *
 *   /urx model use qwen coder        → switch the active on-device model
 *   /urx buff prefix build first     → set a custom persona note
 *   /urx mem write <text>            → write a long-term memory
 *   /urx mem read [query]            → recall memories
 *   /urx mem clear                   → wipe memory
 *   /urx net ping                    → probe remote + local bridges
 *   /urx ui goto <view>              → navigate the shell
 *   /urx sys info                    → real, honest device facts
 *   /urx help                        → grammar reference
 *
 * `autoBuff` extends this: natural prompts like "remember that I ship on Friday"
 * or "switch to qwen coder" are detected and translated into ULX verbs.
 */

import type { Mode, Settings } from '../types'
import { CATALOG } from './localModels'
import { selfKnowledgeFull } from './selfKnowledge'
import { parseReminder } from './reminders'
import { markConfirmed, type SkillRunResult } from './skills'

export type UrxView =
  | 'home' | 'chat' | 'projects' | 'voice' | 'vision' | 'research' | 'files'
  | 'devices' | 'phone' | 'automations' | 'memory' | 'code' | 'tools' | 'settings'

export type UrxResult =
  | { ok: true; action: 'reply'; text: string; kind?: 'info' }
  | { ok: true; action: 'navigate'; view: UrxView }
  | { ok: true; action: 'mode'; mode: Mode }
  | { ok: true; action: 'rerunSetup' }
  | { ok: true; action: 'undo'; label: string }
  | { ok: true; action: 'briefing' }
  | { ok: true; action: 'skills' }
  | { ok: true; action: 'skillRun'; skill: string; arg: string }

export interface UrxEnv {
  settings: Settings
  memories: () => { text: string; kind: string; ts: number }[]
  writeMemory: (text: string, kind?: 'note' | 'pref' | 'fact') => void
  clearMemories: () => void
  removeMemoryByText: (text: string) => boolean
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  navigate: (view: UrxView) => void
  setMode: (mode: Mode) => void
  toast: (title: string, body?: string, kind?: 'success' | 'error' | 'info') => void
  bridges: () => { ollama: boolean; models: string[]; online: boolean }
  newThread: () => void
  /** Undo stack — snapshots of user-visible state the assistant changed. */
  snapshot: () => void
  undo: () => string | null
  addReminder: (text: string, fireAt: number) => void
  requestNotify: () => Promise<boolean>
  briefing: () => string
  /** Async skill execution — resolves via onSkillResult callback in aiStore. */
  runSkill: (id: string, arg: string) => Promise<SkillRunResult>
  bridgeHealth: () => Promise<import('./bridge').BridgeHealth>
}

const VIEWS: UrxView[] = ['home', 'chat', 'projects', 'voice', 'vision', 'research', 'files', 'devices', 'phone', 'automations', 'memory', 'code', 'tools', 'settings']

/** Model ids are matched loosely: "qwen coder" → Qwen2.5-Coder-*. */
export function findModel(query: string): { id: string; label: string } | null {
  const q = query.toLowerCase().trim()
  if (!q) return null
  const compact = q.replace(/[^a-z0-9.]/g, '')
  const hit = CATALOG.find((m) => {
    const id = m.id.toLowerCase()
    const label = m.label.toLowerCase().replace(/[^a-z0-9.]/g, '')
    return id.includes(compact) || label === compact
  })
  if (hit) return { id: hit.id, label: hit.label }
  const fuzzy = CATALOG.find((m) => {
    const label = m.label.toLowerCase()
    return q.split(/\s+/).every((tok) => label.includes(tok) || m.id.toLowerCase().includes(tok))
  })
  return fuzzy ? { id: fuzzy.id, label: fuzzy.label } : null
}

export function modelLabel(id: string): string {
  return CATALOG.find((m) => m.id === id)?.label ?? id
}

export function runUrx(line: string, env: UrxEnv): UrxResult {
  const words = line.trim().split(/\s+/).slice(1) // drop "/urx"
  const [verb = 'help', ...rest] = words
  const arg = rest.join(' ')

  switch (verb.toLowerCase()) {
    case 'help':
      return { ok: true, action: 'reply', kind: 'info', text: URX_HELP }

    case 'model': {
      const sub = (rest[0] ?? 'list').toLowerCase()
      if (sub === 'list') {
        const lines = CATALOG.map((m) => `• ${m.label} — ${m.tier} tier · ~${fmtMb(m.sizeGb)} — ${m.blurb}`)
        const active = env.settings.provider === 'webllm' ? env.settings.webllmModel : null
        return {
          ok: true,
          action: 'reply',
          kind: 'info',
          text: [
            `**On-device catalog — ${CATALOG.length} models**`,
            ...lines,
            '',
            `Active: ${active ? modelLabel(active) : 'none (light core or remote API)'}`,
            'Switch with: /urx model use <name>',
          ].join('\n'),
        }
      }
      if (sub === 'use') {
        const hit = findModel(rest.slice(1).join(' '))
        if (!hit) {
          return { ok: true, action: 'reply', kind: 'info', text: `No catalog model matches "${arg.replace(/^use\s+/i, '')}". Try /urx model list for exact names.` }
        }
        env.setSetting('webllmModel', hit.id)
        env.setSetting('setupDone', false) // rerun wizard → downloads & activates
        return { ok: true, action: 'rerunSetup' }
      }
      return { ok: true, action: 'reply', kind: 'info', text: 'Usage: /urx model [list | use <name>]' }
    }

    case 'buff': {
      const sub = (rest[0] ?? 'show').toLowerCase()
      if (sub === 'prefix' || sub === 'persona') {
        const note = rest.slice(1).join(' ')
        env.setSetting('buffPersona', note)
        return { ok: true, action: 'reply', kind: 'info', text: note ? `Buff persona set: "${note}". Every future reply is primed with it.` : 'Buff persona cleared.' }
      }
      return {
        ok: true,
        action: 'reply',
        kind: 'info',
        text: env.settings.buffPersona ? `Buff layer active — persona: "${env.settings.buffPersona}". Change with /urx buff prefix <note>.` : 'Buff layer is stock. Set a persona with /urx buff prefix <note> — it primes every reply.',
      }
    }

    case 'mem':
    case 'memory': {
      const sub = (rest[0] ?? 'read').toLowerCase()
      if (sub === 'write' || sub === 'add') {
        const text = rest.slice(1).join(' ')
        if (!text) return { ok: true, action: 'reply', kind: 'info', text: 'Usage: /urx mem write <text>' }
        env.writeMemory(text, 'fact')
        return { ok: true, action: 'reply', kind: 'info', text: `Committed to long-term memory: "${text}"\nRecall anytime with /urx mem read.` }
      }
      if (sub === 'clear' || sub === 'wipe') {
        const n = env.memories().length
        env.clearMemories()
        return { ok: true, action: 'reply', kind: 'info', text: `Long-term memory wiped — ${n} record${n === 1 ? '' : 's'} erased.` }
      }
      const query = sub === 'read' ? rest.slice(1).join(' ') : arg
      const all = env.memories()
      const hits = query
        ? all.filter((m) => m.text.toLowerCase().includes(query.toLowerCase()))
        : all
      if (hits.length === 0) {
        return { ok: true, action: 'reply', kind: 'info', text: query ? `Nothing in memory matches "${query}".` : 'Memory is empty — write with /urx mem write <text> or just say "remember that …".' }
      }
      const shown = hits.slice(0, 8)
      return {
        ok: true,
        action: 'reply',
        kind: 'info',
        text: [`**Memory${query ? ` — matches for "${query}"` : ''} (${hits.length})**`, ...shown.map((m) => `• ${m.text}${m.kind !== 'note' ? ` _(${m.kind})_` : ''}`), shown.length < hits.length ? `…and ${hits.length - shown.length} more — open the Memory hub for the full record.` : ''].join('\n'),
      }
    }

    case 'net': {
      const sub = (rest[0] ?? 'status').toLowerCase()
      if (sub === 'ping') {
        const b = env.bridges()
        return { ok: true, action: 'reply', kind: 'info', text: `**Network probe**\n• Internet: ${b.online ? 'ONLINE' : 'OFFLINE'}\n• Remote API endpoint: ${env.settings.baseUrl}\n• Ollama bridge (localhost:11434): ${b.ollama ? `UP — ${b.models.length} model${b.models.length === 1 ? '' : 's'} (${b.models.slice(0, 4).join(', ')}${b.models.length > 4 ? '…' : ''})` : 'not detected'}` }
      }
      return { ok: true, action: 'reply', kind: 'info', text: `**Network status**\n• Internet: ${env.bridges().online ? 'ONLINE' : 'OFFLINE'}\n• Provider: ${env.settings.provider}\nTry /urx net ping for a full bridge probe.` }
    }

    case 'ui': {
      const sub = (rest[0] ?? 'goto').toLowerCase()
      if (sub === 'goto' || sub === 'open') {
        const target = rest.slice(1).join(' ').toLowerCase().replace(/\s+/g, '')
        const view = VIEWS.find((v) => v === target || v.startsWith(target) || target.startsWith(v))
        if (view) {
          env.navigate(view)
          return { ok: true, action: 'navigate', view }
        }
        return { ok: true, action: 'reply', kind: 'info', text: `Unknown view "${rest.slice(1).join(' ')}". Views: ${VIEWS.join(', ')}.` }
      }
      return { ok: true, action: 'reply', kind: 'info', text: 'Usage: /urx ui goto <view>' }
    }

    case 'sys':
      return { ok: true, action: 'reply', kind: 'info', text: selfKnowledgeFull(env.settings) }

    case 'mode': {
      const m = (rest[0] ?? 'auto').toLowerCase() as Mode
      const valid: Mode[] = ['auto', 'reason', 'research', 'vision', 'code', 'create', 'plan', 'focus', 'study', 'developer']
      if (!valid.includes(m)) return { ok: true, action: 'reply', kind: 'info', text: `Unknown mode "${rest[0]}". Valid: ${valid.join(', ')}.` }
      env.setMode(m)
      return { ok: true, action: 'mode', mode: m }
    }

    case 'clear':
      env.newThread()
      return { ok: true, action: 'reply', kind: 'info', text: 'Thread cleared. Fresh context.' }

    case 'remind': {
      const raw = rest.join(' ')
      const parsed = parseReminder(raw)
      if (!parsed) {
        return { ok: true, action: 'reply', kind: 'info', text: 'Usage: /urx remind <text> in <10 minutes | 2 hours | 1 day> — or "at 18:45".\nExamples: /urx remind stretch in 45 minutes · /urx remind call mom at 18:30' }
      }
      void env.requestNotify()
      env.addReminder(parsed.text, parsed.fireAt)
      const when = new Date(parsed.fireAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return { ok: true, action: 'reply', kind: 'info', text: `⏰ Scheduled: "${parsed.text}" at ${when}.\nFires in-app (and as an OS notification if permitted while the tab is hidden). Note: this tab must stay open.` }
    }

    case 'undo': {
      const label = env.undo()
      return label
        ? { ok: true, action: 'undo', label }
        : { ok: true, action: 'reply', kind: 'info', text: 'Nothing to undo — the assistant has not changed anything yet this session.' }
    }

    case 'briefing':
      return { ok: true, action: 'briefing' }

    case 'skills':
      return { ok: true, action: 'skills' }

    case 'skill': {
      // /urx skill run <id> <arg…>  |  /urx skill confirm <id> <arg…>
      const sub = (rest[0] ?? 'list').toLowerCase()
      if (sub === 'list' || !rest[0]) return { ok: true, action: 'skills' }
      if (sub === 'confirm' && rest[1]) {
        markConfirmed(rest.slice(2).join(' '))
        return { ok: true, action: 'skillRun', skill: rest[1], arg: rest.slice(2).join(' ') }
      }
      if (sub === 'run' && rest[1]) {
        return { ok: true, action: 'skillRun', skill: rest[1], arg: rest.slice(2).join(' ') }
      }
      return { ok: true, action: 'reply', kind: 'info', text: 'Usage: /urx skill run <id> [arg] · /urx skill list' }
 }

    default:
      return { ok: true, action: 'reply', kind: 'info', text: `Unknown ULX verb "${verb}".\n\n${URX_HELP}` }
  }
}

export const URX_HELP = [
  '**ULX — U.L.T.R.0.N. Language eXtension**',
  'The command grammar of the buff layer. Every verb touches real state:',
  '',
  '• /urx model list — the on-device catalog (sizes, tiers, blurbs)',
  '• /urx model use qwen coder — download & activate a model',
  '• /urx buff prefix <note> — set a persona primed into every reply',
  '• /urx buff — inspect the buff layer',
  '• /urx mem write <text> — commit a long-term memory',
  '• /urx mem read [query] — recall memories',
  '• /urx mem clear — wipe memory',
  '• /urx net ping — probe internet + local bridges (Ollama on :11434)',
  '• /urx remind <text> in 30 minutes — schedule a real in-app reminder',
  '• /urx undo — take back the last thing the assistant changed',
  '• /urx skills — everything I can DO right now (uploads, laptop control…)',
  '• /urx skill run <id> <arg> — execute a skill (laptop.exec asks first)',
  '• /urx briefing — morning briefing (memories, machine, suggestion)',
  '• /urx ui goto <view> — navigate (chat, code, memory, tools…)',
  '• /urx mode <name> — switch reasoning mode',
  '• /urx sys info — what I am, what this machine is, what I cannot do',
  '• /urx clear — new thread',
  '',
  'autoBuff also catches natural language: "remember that…", "switch to qwen coder", "go to code".',
].join('\n')

/** Natural-language → ULX translation (autoBuff). Returns null when nothing matches. */
export function detectBuffCommand(text: string): UrxResult | null {
  const t = text.toLowerCase().trim()

  const remember = t.match(/^(?:please\s+)?(?:remember|memorize|note)\s+(?:that\s+)?(.{4,240})$/)
  if (remember) return { ok: true, action: 'reply', kind: 'info', text: `Committed to memory: "${remember[1]}"` }

  // "remind me to stretch in 45 minutes" / "remind me to call mom at 18:30"
  const reminder = t.match(/^(?:please\s+)?remind me (?:to |about )?(.{4,200})$/)
  if (reminder && parseReminder(`remind me to ${reminder[1]}`)) {
    return { ok: true, action: 'reply', kind: 'info', text: '__REMINDER__' }
  }

  if (/^(?:switch|change|swap)\s+(?:to|the\s+model\s+to)?\s*(?:the\s+)?[a-z0-9.\s-]+$/.test(t) && /coder|qwen|llama|phi|smol|deepseek|b\b/.test(t)) {
    const hit = findModel(t.replace(/^(?:switch|change|swap)\s+(?:to|the\s+model\s+to)?\s*(?:the\s+)?/, ''))
    if (hit) return { ok: true, action: 'rerunSetup' }
  }

  const goto = t.match(/^(?:go|jump|navigate|take me)\s+(?:to|into)\s+(?:the\s+)?([a-z]+)$/)
  if (goto) {
    const target = goto[1]
    const view = VIEWS.find((v) => v === target || v.startsWith(target))
    if (view) return { ok: true, action: 'navigate', view }
  }

  return null
}

/** Execute a detected buff command through the environment. */
export function executeBuffCommand(res: NonNullable<ReturnType<typeof detectBuffCommand>>, env: UrxEnv, originalText = ''): UrxResult {
  if (res.action === 'rerunSetup') {
    env.setSetting('setupDone', false)
    return { ok: true, action: 'rerunSetup' }
  }
  if (res.action === 'navigate') {
    env.navigate(res.view)
    return res
  }
  // "remember that …" — commit to long-term memory for real
  const remember = originalText.toLowerCase().match(/^(?:please\s+)?(?:remember|memorize|note)\s+(?:that\s+)?(.{4,240})$/)
  if (remember) {
    env.snapshot()
    env.writeMemory(remember[1].trim(), 'fact')
    return { ok: true, action: 'reply', kind: 'info', text: `Committed to memory: "${remember[1].trim()}"\n(Revert with /urx undo)` }
  }

  // "open youtube / open instagram.com" — real laptop control via skill
  const t = originalText.toLowerCase().trim()
  const open = t.match(/^(?:please\s+)?(?:open|launch|go open)\s+((?:https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?|(?:youtube|instagram|twitter|x|github|reddit|gmail|netflix)\b)[.!]?$/)
  if (open) {
    const sites: Record<string, string> = { youtube: 'https://youtube.com', instagram: 'https://instagram.com', twitter: 'https://twitter.com', x: 'https://x.com', github: 'https://github.com', reddit: 'https://reddit.com', gmail: 'https://mail.google.com', netflix: 'https://netflix.com' }
    const target = sites[open[1]] ?? open[1]
    return { ok: true, action: 'skillRun', skill: 'web.open', arg: target }
  }

  // "write a viral hook about X" / "make a caption for X"
  const hook = t.match(/^(?:write|make|generate)\s+(?:me\s+)?(?:a\s+)?viral\s+(?:hook|caption|title)s?\s+(?:about|for)\s+(.{3,120})[.!]?$/)
  if (hook) return { ok: true, action: 'skillRun', skill: 'viral.hook', arg: hook[1] }

  // "upload my video to youtube" — guide to the real pipeline
  if (/^upload .*(video|clip).* (to|on) youtube/.test(t)) {
    return { ok: true, action: 'skillRun', skill: 'youtube.upload', arg: originalText.replace(/^.*?(?:upload)/i, '').trim() || '' }
  }
  return res
}

function fmtMb(gb: number): string {
  return gb < 1 ? `${Math.round(gb * 1000)}MB` : `${gb.toFixed(1)}GB`
}
