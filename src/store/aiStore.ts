import { create } from 'zustand'
import type { AiState, Attachment, ChatMessage, Mode } from '../types'
import { useUi } from './uiStore'
import { useSettings } from './settingsStore'
import { useMemory } from './memoryStore'
import { nextId } from '../lib/id'
import { modelLabel, runUrx, detectBuffCommand, executeBuffCommand, URX_HELP, type UrxEnv } from '../lib/urx'
import { CATALOG } from '../lib/localModels'
import { armAll, addReminder, requestNotifyPermission } from '../lib/reminders'
import { maybeBriefOnBoot, buildBriefing } from '../lib/briefing'
import { runSkill, skillsReport, currentBridgeHealth, markConfirmed } from '../lib/skills'
import type { Settings } from '../types'

const BANNER = `U.L.T.R.0.N. // Unified Logic, Tactical Reasoning & Zero-Point Network
Local reasoning core online. Buff layer (ULX) armed — the shell takes commands, not just questions.
Try /help · /urx help · /models · /diagnostics — or press Ctrl+K for the command palette.`

interface AiStore {
  state: AiState
  progress: number
  messages: ChatMessage[]
  streaming: boolean
  attachments: Attachment[]
  input: string
  mode: Mode
  send: (text: string) => Promise<void>
  stop: () => void
  setInput: (v: string) => void
  attach: (a: Attachment) => void
  detach: (id: string) => void
  newThread: () => void
  setMode: (m: Mode) => void
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function offlineNotice(text: string): string {
  return `⚠ You are OFFLINE, so I can't reach remote reasoning for "${text}".
Everything else keeps working: local files, memory, settings and system telemetry are fully local.
Run /models to check whether an on-device model is installed, or /diagnostics for a status sweep.`
}

let abort: { cancelled: boolean } | null = null

export const useAi = create<AiStore>()((set, get) => ({
  state: 'idle',
  progress: 0,
  messages: [
    { id: 'banner', role: 'assistant', text: BANNER, ts: Date.now(), kind: 'info' },
  ],
  streaming: false,
  attachments: [],
  input: '',
  mode: 'auto',

  setMode: (m) => {
    set({ mode: m })
    useUi.setState({ mode: m })
  },

  setInput: (v) => set({ input: v }),

  attach: (a) => set((s) => ({ attachments: [...s.attachments, a] })),
  detach: (id) => set((s) => ({ attachments: s.attachments.filter((x) => x.id !== id) })),

  newThread: () => {
    if (abort) abort.cancelled = true
    set({ messages: [{ id: 'banner', role: 'assistant', text: BANNER, ts: Date.now(), kind: 'info' }], state: 'idle', streaming: false, progress: 0 })
  },

  stop: () => {
    if (abort) abort.cancelled = true
    // Hard-stop the WebLLM engine too, else tokens keep generating internally
    void import('../lib/localModels').then((m) => m.interruptGeneration())
    set({ state: 'idle', streaming: false, progress: 0 })
  },

  send: async (text) => {
    const trimmed = text.trim()
    if (!trimmed || get().streaming) return
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text: trimmed, ts: Date.now() }
    const attached = get().attachments
    set({ messages: [...get().messages, userMsg], input: '', attachments: [], state: 'thinking', streaming: true, progress: 0 })
    abort = { cancelled: false }
    const myAbort = abort

    const finishInfo = (reply: string, model: string) => {
      set({
        messages: [...get().messages, { id: nextId(), role: 'assistant', text: reply, ts: Date.now(), kind: 'info' as const, model }],
        state: 'idle' as const, streaming: false, progress: 0,
      })
    }

    // --- Shell slash commands ---
    if (trimmed.startsWith('/') && !trimmed.toLowerCase().startsWith('/urx')) {
      await sleep(200)
      if (myAbort.cancelled) return
      finishInfo(handleCommand(trimmed), 'shell')
      return
    }

    // --- ULX explicit command (/urx …) ---
    if (trimmed.toLowerCase().startsWith('/urx')) {
      await sleep(150)
      if (myAbort.cancelled) return
      const env = makeEnv()
      const result = runUrx(trimmed, env)
      if (result.action === 'rerunSetup') {
        useSettings.getState().set('setupDone', false)
        set({ state: 'idle', streaming: false, progress: 0 })
        return
      }
      if (result.action === 'navigate' || result.action === 'mode') {
        set({ state: 'idle', streaming: false, progress: 0 })
        return
      }
      if (result.action === 'undo') {
        useUi.getState().pushToast({ title: 'Undone', body: result.label, kind: 'success' })
        finishInfo(`↩ Undone: ${result.label}`, 'ulx')
        return
      }      if (result.action === 'briefing') {
        finishInfo(env.briefing(), 'briefing')
        return
 }
      if (result.action === 'skills') {
        const h = await env.bridgeHealth()
        finishInfo(`**Skills live right now**\n\n${skillsReport(h)}\n\nRun one: /urx skill run <id> <arg> — or just ask in plain words.`, 'ulx')
        return
 }
      if (result.action === 'skillRun') {
        const out = await env.runSkill(result.skill, result.arg)
        if (out.pendingConfirm) {
          // second run with the same arg is treated as confirmed
          markConfirmed(out.pendingConfirm.arg)
          const second = await env.runSkill(out.pendingConfirm.skill, out.pendingConfirm.arg)
          finishInfo(second.text, 'skill')
          return
        }
        finishInfo(out.text, 'skill')
        return
 }
      finishInfo(result.text, 'ulx')
      return
    }

    // --- autoBuff: natural language that maps to ULX verbs ---
    const settings0 = useSettings.getState().settings
    if (settings0.autoBuff) {
      const detected = detectBuffCommand(trimmed)
      if (detected) {
        const env = makeEnv()
        const result = executeBuffCommand(detected, env, trimmed)
        if (result.action === 'skillRun') {
          const out = await env.runSkill(result.skill, result.arg)
          if (out.pendingConfirm) {
            markConfirmed(out.pendingConfirm.arg)
            const second = await env.runSkill(out.pendingConfirm.skill, out.pendingConfirm.arg)
            finishInfo(second.text, 'skill')
            return
          }
          finishInfo(out.text, 'skill')
          return
        }
        if (result.action === 'rerunSetup') {
          useSettings.getState().set('setupDone', false)
          set({ state: 'idle', streaming: false, progress: 0 })
          return
        }
        if (result.action === 'undo') {
          const label = env.undo()
          useUi.getState().pushToast({ title: 'Undone', body: label ?? 'nothing', kind: 'success' })
          finishInfo(label ? `↩ Undone: ${label}` : 'Nothing to undo yet.', 'buff')
          return
        }
        if (result.action !== 'reply') {
          set({ state: 'idle', streaming: false, progress: 0 })
          return
        }
        // Pending reminder from executeBuffCommand — rebuild with parsed time.
        if (result.text === '__REMINDER__') {
          const remEnv = makeEnv()
          const parsed = (await import('../lib/reminders')).parseReminder(trimmed)
          if (parsed) {
            void remEnv.requestNotify()
            remEnv.addReminder(parsed.text, parsed.fireAt)
            const when = new Date(parsed.fireAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            finishInfo(`⏰ Scheduled: "${parsed.text}" at ${when}.\nI will ping you in-app — the tab must stay open.`, 'buff')
            return
          }
        }
        await sleep(220)
        if (myAbort.cancelled) return
        finishInfo(result.text, 'buff')
        return
      }
    }

    // --- AI generation: real streaming into the assistant bubble ---
    const { getAiSettings } = await import('./settingsStore')
    const { callAi } = await import('../lib/ai')
    const settings = getAiSettings()
    // Skills hint only for big/remote models — small on-device ones stay lean
    const skillsHint = settings.provider === 'remote' ? skillsReport(await currentBridgeHealth()) : undefined
    const history = get()
      .messages.filter((m) => !m.kind && m.id !== 'banner')
      .slice(-10)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text }))

    if (!navigator.onLine && settings.provider === 'remote') {
      await typeOut(set, get, myAbort, offlineNotice(trimmed), 'shell', 'info')
      return
    }

    const msgId = nextId()
    const engineCold = settings.provider === 'webllm' && !(await import('../lib/localModels')).engineReady()
    set({
      messages: [...get().messages, {
        id: msgId, role: 'assistant', ts: Date.now(), kind: 'pending',
        text: engineCold ? '_Waking the model from cache — first message only…_' : '',
      }],
      state: engineCold ? 'processing' : 'responding', progress: 0.3,
    })
    const patch = (s: string) => {
      set({ messages: get().messages.map((m) => (m.id === msgId ? { ...m, text: s } : m)) })
    }

    // Generate with graceful degradation: engine retry → GPU-fallback → error
    const gpuIssue = (msg: string) => /mapAsync|GPUBuffer|WebGPU|adapter|compatible GPU|shader|f16|cache|device/i.test(msg)
    let attempt = 0
    let done = false
    while (!done) {
      try {
        const { text, meta } = await callAi(settings, trimmed, {
          turns: history.length ? history : [{ role: 'user', content: trimmed }],
          mode: get().mode,
          attached,
          skillsHint,
          onDelta: (d) => {
            const cur = get().messages.find((m) => m.id === msgId)
            const wasPending = cur?.kind === 'pending'
            // first real token wipes any loading note entirely
            patch(wasPending ? d : (cur?.text ?? '') + d)
            if (wasPending) set({ messages: get().messages.map((m) => (m.id === msgId ? { ...m, kind: undefined } : m)) })
          },
          signal: myAbort,
        })
        if (myAbort.cancelled) return
        const finalText = get().messages.find((m) => m.id === msgId)?.text ?? ''
        if (!finalText.trim() && text) patch(text)
        set({
          messages: get().messages.map((m) => (m.id === msgId ? { ...m, model: `${meta.model} · ${meta.provider}` } : m)),
          state: 'idle', streaming: false, progress: 0,
        })
        done = true
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!gpuIssue(msg) || myAbort.cancelled) {
          // Non-GPU failure: honest error, nothing we can recover from here.
          set({
            messages: get().messages.map((m) =>
              m.id === msgId
                ? { ...m, text: (m.text ? m.text + '\n\n' : '') + `✗ Request failed: ${msg}\nCheck Settings → AI (provider, model, key) or run /diagnostics.`, kind: 'error' as const }
                : m,
            ),
            state: 'idle', streaming: false, progress: 0,
          })
          done = true
        } else if (attempt === 0) {
          // First GPU failure: rebuild the engine once and retry transparently.
          attempt++
          patch('_GPU context hiccup — rebuilding the engine, one moment…_')
          const lm = await import('../lib/localModels')
          await lm.resetEngine()
          try { await lm.ensureEngine(settings.webllmModel) } catch { /* fall through to local core below */ }
          set({ messages: get().messages.map((m) => (m.id === msgId ? { ...m, kind: 'pending' as const } : m)) })
        } else {
          // Still failing — degrade to the light core so the operator gets an answer.
          patch('⚠ The GPU can\'t run this model right now — answering with the local core.\nRun /setup and pick a q4f32_1 build, or refresh the page to restore WebGPU.\n\n')
          const { callAiLocal } = await import('../lib/ai')
          const local = await callAiLocal(trimmed, get().mode, attached)
          const cur = get().messages.find((m) => m.id === msgId)
          patch((cur?.text ?? '') + local)
          set({
            messages: get().messages.map((m) => (m.id === msgId ? { ...m, kind: 'info' as const, model: 'local core (GPU unavailable)' } : m)),
            state: 'idle', streaming: false, progress: 0,
          })
          done = true
        }
      }
    }
  },
}))

type SetFn = (partial: Partial<AiStore>) => void
type GetFn = () => AiStore

/** Typed-out delivery for static replies (offline notice). */
async function typeOut(set: SetFn, get: GetFn, myAbort: { cancelled: boolean }, reply: string, model: string, kind: 'info' | 'error' = 'info') {
  const msgId = nextId()
  set({ messages: [...get().messages, { id: msgId, role: 'assistant', text: '', ts: Date.now(), kind, model }] })
  const step = Math.max(1, Math.round(reply.length / 90))
  let i = 0
  while (i < reply.length) {
    if (myAbort.cancelled) return
    i = Math.min(reply.length, i + step)
    set({ messages: get().messages.map((m) => (m.id === msgId ? { ...m, text: reply.slice(0, i) } : m)) })
    await sleep(13)
  }
  set({ state: 'idle', streaming: false, progress: 0 })
}

/**
 * Undo stack — snapshots of user-visible state before the assistant changes it.
 * Mark-LIV rule: take back what the assistant did — memories, settings, model.
 */
interface Snapshot {
  label: string
  memories: { text: string; kind: 'note' | 'pref' | 'fact' }[]
  settings: Settings
}
const undoStack: Snapshot[] = []

function pushSnapshot(label: string): void {
  undoStack.push({
    label,
    memories: useMemory.getState().memories.map((m) => ({ text: m.text, kind: m.kind })),
    settings: { ...useSettings.getState().settings },
  })
  if (undoStack.length > 25) undoStack.shift()
}

/** UrxEnv wired to the real stores. */
function makeEnv(): UrxEnv {
  return {
    settings: useSettings.getState().settings,
    memories: () => useMemory.getState().memories,
    writeMemory: (text, kind) => useMemory.getState().addMemory(text, kind),
    clearMemories: () => useMemory.getState().clearAll(),
    removeMemoryByText: (text) => {
      const m = useMemory.getState().memories
      const hit = m.find((x) => x.text === text)
      if (!hit) return false
      useMemory.getState().removeMemory(hit.id)
      return true
    },
    setSetting: (key, value) => useSettings.getState().set(key, value),
    navigate: (view) => useUi.getState().setView(view),
    setMode: (mode) => useAi.getState().setMode(mode),
    toast: (title, body, kind) => useUi.getState().pushToast({ title, body, kind: kind ?? 'info' }),
    bridges: () => ({ ollama: false, models: [], online: navigator.onLine }),
    newThread: () => useAi.getState().newThread(),
    snapshot: (label = 'change') => pushSnapshot(label),
    undo: () => {
      const snap = undoStack.pop()
      if (!snap) return null
      // restore memories
      const cur = useMemory.getState()
      cur.clearAll()
      for (const m of snap.memories) cur.addMemory(m.text, m.kind)
      // restore settings wholesale
      const prev = useSettings.getState().settings
      for (const k of Object.keys(snap.settings) as (keyof Settings)[]) {
        if (prev[k] !== snap.settings[k]) useSettings.getState().set(k, snap.settings[k])
      }
      return snap.label
    },
    addReminder: (text, fireAt) => addReminder(text, fireAt),
    requestNotify: () => requestNotifyPermission(),
    briefing: () => buildBriefing(),
    runSkill: (id, arg) => runSkill(id, arg),
    bridgeHealth: () => currentBridgeHealth(),
  }
}

/** Boot-time housekeeping: re-arm reminders, warm the model, greet once per day. */
export function bootAssistant(): void {
  armAll()
  // Warm the engine NOW (background) so the first message answers instantly
  // instead of waiting for a cache reload mid-conversation.
  const s = useSettings.getState().settings
  if (s.provider === 'webllm' && s.webllmModel) {
    void import('../lib/localModels').then((m) => m.ensureEngine(s.webllmModel)).catch(() => { /* surfaced on send */ })
  }
  const text = maybeBriefOnBoot()
  if (text) {
    // delivered as the first chat message after the banner
    window.setTimeout(() => {
      useAi.setState({
        messages: [
          ...useAi.getState().messages,
          { id: nextId(), role: 'assistant', text, ts: Date.now(), kind: 'info', model: 'briefing' },
        ],
      })
    }, 600)
  }
}

function handleCommand(raw: string): string {
  const [cmd, ...rest] = raw.slice(1).split(/\s+/)
  const arg = rest.join(' ')
  switch ((cmd || '').toLowerCase()) {
    case 'help':
      return [
        '**Command set**',
        '• /help — this list',
        '• /urx help — the ULX grammar: model · buff · mem · net · ui · sys · mode',
        '• /diagnostics — local core status',
        '• /models — on-device catalog + active model',
        '• /briefing — morning briefing: memories, machine, suggestion',
        '• /setup — rerun the local-model setup wizard',
        '• /mode <name> — switch mode (auto, reason, code, create…)',
        '• /clear — new thread',
        '• /memory — open the memory hub',
        '',
        `Argument received: ${arg || '—'}`,
      ].join('\n')
    case 'urx':
      // Handled in send() before this point; kept for direct calls.
      return URX_HELP
    case 'diagnostics':
      return [
        'Diagnostics:',
        `• Network: ${navigator.onLine ? 'ONLINE' : 'OFFLINE (local-only mode)'}`,
        `• Hardware threads: ${navigator.hardwareConcurrency ?? 'unknown'}`,
        `• Platform: ${navigator.platform}`,
        `• Speech synthesis: ${window.speechSynthesis ? 'available' : 'unavailable'}`,
        '• Media devices: gated until you open Voice or Vision',
      ].join('\n')
    case 'models': {
      const s = useSettings.getState().settings
      const lines = [
        `**On-device catalog — ${s.webllmModel ? 'active: ' + modelLabel(s.webllmModel) : 'none active'}**`,
        '',
        ...CATALOG_LINES(),
        '',
        'Switch with /urx model use <name>, or /setup for the guided wizard.',
      ]
      return lines.join('\n')
    }
    case 'mode': {
      const m = (arg || 'auto').toLowerCase() as Mode
      const valid: Mode[] = ['auto', 'reason', 'research', 'vision', 'code', 'create', 'plan', 'focus', 'study', 'developer']
      if (!valid.includes(m)) return `Unknown mode "${arg}". Valid: ${valid.join(', ')}`
      useAi.getState().setMode(m)
      return `Mode set to ${m.toUpperCase()}.`
    }
    case 'clear':
      useAi.getState().newThread()
      return 'Thread cleared.'
    case 'memory':
      useUi.getState().setView('memory')
      return 'Opening memory hub…'
    case 'briefing':
      return buildBriefing()
    case 'setup':
      useSettings.getState().set('setupDone', false)
      return 'Reopening the local-intelligence setup wizard…'
    default:
      return `Unknown command "/${cmd}". Try /help.`
  }
}

function CATALOG_LINES(): string[] {
  return CATALOG.map((m) => {
    const tags = m.tags?.length ? ` [${m.tags.join(', ')}]` : ''
    return `• ${m.label}${tags} — ${m.tier} tier · ~${m.sizeGb < 1 ? Math.round(m.sizeGb * 1000) + 'MB' : m.sizeGb.toFixed(1) + 'GB'}`
  })
}
