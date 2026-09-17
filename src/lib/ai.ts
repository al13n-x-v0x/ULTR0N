import type { Attachment, ChatMessage, Mode, Settings } from '../types'
import { modelLabel } from './urx'
import { selfKnowledgeBrief } from './selfKnowledge'
import { recallHint } from './memoryRecall'

export interface AiMeta {
  provider: 'local' | 'remote' | 'webllm'
  model: string
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const MODE_PRIMER: Record<Mode, string> = {
  auto: 'Balance speed and depth.',
  reason: 'Reason step by step, show the chain of thought compactly.',
  research: 'Cite sources when possible, be thorough and factual.',
  vision: 'Describe visual inputs precisely.',
  code: 'You are in CODE mode: prefer complete, runnable code with concise explanations. Use fenced code blocks with language tags.',
  create: 'Be imaginative and bold.',
  plan: 'Deliver an actionable plan with phases and checkpoints.',
  focus: 'Be extremely brief.',
  study: 'Explain pedagogically with examples.',
  developer: 'Technical depth: APIs, algorithms, tradeoffs.',
}

export function buildSystemPrompt(settings: Settings, mode: Mode, skillsHint?: string): string {
  // Small on-device models (<2B): LEAN prompt. Long identity/skills/memory
  // blocks slow prefill and confuse tiny models — this is the #1 speed lever.
  const active = getCatalog().find((m) => m.id === settings.webllmModel)
  const smallModel = !!active && /0\.5B|360M|1B|SmolLM2 · 360M/.test(active.label) && active.tier === 'low'
  if (smallModel) {
    const base = `You are U.L.T.R.0.N., a concise helpful assistant. ${MODE_PRIMER[mode]}`
    return settings.buffPersona.trim() ? `${base} Persona: ${settings.buffPersona.trim()}` : base
  }
  const lines = [
    `You are U.L.T.R.0.N. (Unified Logic, Tactical Reasoning & Zero-Point Network), an AI made by AL13N INDUSTRIES. ${MODE_PRIMER[mode]}`,
  ]
  // Mark-LIV pattern: runtime self-knowledge assembled from the live system
  lines.push(selfKnowledgeBrief(settings))
  if (skillsHint) {
    lines.push(`SKILLS YOU CAN EXECUTE when the operator asks (the shell runs them):\n${skillsHint}\nOffer these naturally — e.g. "open youtube", "write a viral hook about…", "upload my video to youtube".`)
  }
  const mem = recallHint()
  if (mem) lines.push(mem)
  if (settings.buffPersona.trim()) lines.push(`Operator persona directive: ${settings.buffPersona.trim()}`)
  return lines.join('\n\n')
}

// CATALOG handle without a static import cycle (localModels does not import ai)
import type { ModelSpec } from './localModels'
let CATALOG: ModelSpec[] = []
void import('./localModels').then((m) => { CATALOG = m.CATALOG })
function getCatalog(): ModelSpec[] { return CATALOG }

export function attachmentContext(attached: Attachment[]): string {
  if (attached.length === 0) return ''
  return attached
    .map((a) => {
      if (a.text) return `[Attached file: ${a.name}]\n${a.text}`
      return `[Attached: ${a.name} (${a.kind || 'file'})]`
    })
    .join('\n\n')
}

/* ---------------- Remote OpenAI-compatible (true SSE streaming) ---------------- */

export async function callAiRemote(
  settings: Settings,
  turns: { role: 'user' | 'assistant'; content: string }[],
  mode: Mode,
  attached: Attachment[],
  onDelta: (chunk: string) => void,
  signal?: { cancelled: boolean },
  skillsHint?: string,
): Promise<AiMeta> {
  const sys = buildSystemPrompt(settings, mode, skillsHint)
  const ctx = attachmentContext(attached)
  const history = ctx
    ? [...turns, { role: 'user' as const, content: ctx }]
    : turns
  const res = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: true,
      messages: [
        { role: 'system', content: sys },
        ...history.map((t) => ({ role: t.role, content: t.content })),
      ],
    }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(90000) : undefined,
  })
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text.slice(0, 160) || res.statusText}`)
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    if (signal?.cancelled) { reader.cancel().catch(() => {}); return { provider: 'remote', model: settings.model } }
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const payload = t.slice(5).trim()
      if (payload === '[DONE]') return { provider: 'remote', model: settings.model }
      try {
        const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }
        const d = json.choices?.[0]?.delta?.content
        if (d) onDelta(d)
      } catch { /* partial chunk */ }
    }
  }
  return { provider: 'remote', model: settings.model }
}

/* ---------------- On-device WebLLM (true token streaming) ---------------- */

export async function callAiWebllm(
  settings: Settings,
  turns: { role: 'user' | 'assistant'; content: string }[],
  mode: Mode,
  attached: Attachment[],
  onDelta: (chunk: string) => void,
  signal?: { cancelled: boolean },
): Promise<AiMeta> {
  const { chatLocalModel, ensureEngine } = await import('./localModels')
  // Auto-recovery after page reloads — weights come back from the browser cache.
  await ensureEngine(settings.webllmModel)
  // Small on-device models need a LEAN prompt — long identity/skills blocks
  // slow prefill and confuse tiny models. This is the biggest speed lever.
  const sys = buildSystemPrompt(settings, mode)
  const ctx = attachmentContext(attached)
  const last = ctx ? { role: 'user' as const, content: `${turns[turns.length - 1]?.content ?? ''}\n\n${ctx}` } : turns[turns.length - 1]
  const prior = ctx ? turns.slice(0, -1) : turns
  let out = ''
  await chatLocalModel(
    [...prior.map((t) => ({ role: t.role, content: t.content })), last].filter((t) => t.content.length > 0),
    (d) => { out += d; onDelta(d) },
    signal,
    sys,
  )
  if (out.trim().length === 0) {
    if (signal?.cancelled) throw new Error('Stopped.')
    // One quiet retry — tiny models sometimes emit only an EOS token.
    await chatLocalModel([{ role: 'user', content: turns[turns.length - 1]?.content ?? 'Hello' }], (d) => { out += d; onDelta(d) }, signal)
    if (out.trim().length === 0) throw new Error('On-device model returned an empty response — try rephrasing, or run /setup to reinstall the model.')
  }
  return { provider: 'webllm', model: modelLabel(settings.webllmModel) }
}

/* ---------------- Local heuristic core (last-resort, offline, honest) ---------------- */

export async function callAiLocal(prompt: string, mode: Mode, attached: Attachment[]): Promise<string> {
  await sleep(250)
  const q = prompt.toLowerCase()
  const has = (...k: string[]) => k.some((x) => q.includes(x))

  if (has('cpu', 'ram', 'memory use', 'system status', 'status')) {
    return [
      '**Local core status**',
      '• Reasoning core: online (heuristic mode)',
      `• Threads available: ${navigator.hardwareConcurrency ?? '?'}`,
      `• Speech synthesis: ${window.speechSynthesis ? 'ready' : 'unavailable'}`,
      '• Live CPU/RAM meters: Tools → System Monitor',
      '',
      'For full reasoning power, download an on-device model (/setup) or connect a provider in Settings → AI.',
    ].join('\n')
  }
  if (attached.length > 0) {
    return [
      `Received ${attached.length} attachment${attached.length > 1 ? 's' : ''}:`,
      ...attached.map((a) => `• ${a.name} — ${a.text ? `${a.text.length} chars extracted` : a.kind}`),
      '',
      'Staged into workspace context. Attachments are included in the prompt once a model is active — run /setup for an on-device one.',
    ].join('\n')
  }
  return [
    `**${mode.toUpperCase()} mode · local core**`,
    '',
    `Task logged: "${prompt.slice(0, 120)}".`,
    'I run fully offline in this mode, so depth is limited. Two upgrades:',
    '• /setup — install an on-device model (WebGPU, private, offline-capable)',
    '• Settings → AI — connect any OpenAI-compatible API',
    '',
    'Or steer the shell directly: /urx help',
  ].join('\n')
}

/* ---------------- Bridges (buff connectivity layer) ---------------- */

export interface BridgeReport {
  ollama: { up: boolean; models: string[]; error?: string }
  remote: { reachable: boolean; error?: string }
}

/** Probe an OpenAI-compatible endpoint with a cheap models list. */
export async function probeRemote(baseUrl: string, apiKey: string): Promise<{ reachable: boolean; error?: string }> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
    })
    return { reachable: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` }
  } catch (err) {
    return { reachable: false, error: err instanceof Error ? err.message : 'unreachable' }
  }
}

export async function probeBridges(settings: Settings): Promise<BridgeReport> {
  const [{ detectOllama }, remote] = await Promise.all([
    import('./localModels'),
    navigator.onLine ? probeRemote(settings.baseUrl, settings.apiKey) : Promise.resolve({ reachable: false, error: 'offline' }),
  ])
  const ollama = await detectOllama()
  return { ollama: { up: ollama.ok, models: ollama.models, error: ollama.error }, remote }
}

/* ---------------- Dispatcher with graceful degradation ---------------- */

export interface CallOptions {
  /** Conversation history (oldest first, includes the new user message last). */
  turns: { role: 'user' | 'assistant'; content: string }[]
  mode: Mode
  attached: Attachment[]
  onDelta: (chunk: string) => void
  signal?: { cancelled: boolean }
  /** Live skills report so the AI knows what it can honestly offer to DO. */
  skillsHint?: string
}

/** Router: on-device model → remote API → local heuristic core. Streams when possible.
 * For webllm/remote the full text is delivered via onDelta (return value carries meta only).
 */
export async function callAi(settings: Settings, prompt: string, opts: CallOptions): Promise<{ text: string; meta: AiMeta }> {
  const { turns, mode, attached, onDelta, signal } = opts
  if (settings.provider === 'webllm' && settings.webllmModel) {
    const meta = await callAiWebllm(settings, turns, mode, attached, onDelta, signal)
    return { text: '', meta }
  }
  if (settings.provider === 'remote' && settings.apiKey.trim().length > 0 && navigator.onLine) {
    const meta = await callAiRemote(settings, turns, mode, attached, onDelta, signal, opts.skillsHint)
    return { text: '', meta }
  }
  const text = await callAiLocal(prompt, mode, attached)
  for (const ch of text) {
    if (signal?.cancelled) break
    onDelta(ch)
  }
  return { text, meta: { provider: 'local', model: 'heuristic core' } }
}

/** Tiny helper for one-shot asks (Code workspace, tools) — non-streaming convenience. */
export async function askAi(settings: Settings, prompt: string, mode: Mode, history: ChatMessage[] = []): Promise<string> {
  if (settings.provider === 'webllm' && settings.webllmModel) {
    const { engineReady, chatLocalModel } = await import('./localModels')
    if (!engineReady()) throw new Error('On-device model not loaded — run Setup again.')
    let out = ''
    await chatLocalModel(
      [...history.filter((m) => !m.kind).slice(-6).map((m) => ({ role: m.role, content: m.text })), { role: 'user' as const, content: prompt }],
      (d) => { out += d },
    )
    return out
  }
  if (settings.provider === 'remote' && settings.apiKey.trim().length > 0 && navigator.onLine) {
    let out = ''
    await callAiRemote(
      settings,
      [...history.filter((m) => !m.kind).slice(-6).map((m) => ({ role: m.role, content: m.text })), { role: 'user' as const, content: prompt }],
      mode,
      [],
      (d) => { out += d },
    )
    return out
  }
  if (settings.provider === 'webllm' && settings.webllmModel) {
    const { chatLocalModel, ensureEngine } = await import('./localModels')
    await ensureEngine(settings.webllmModel)
    let out = ''
    await chatLocalModel(
      [...history.filter((m) => !m.kind).slice(-6).map((m) => ({ role: m.role, content: m.text })), { role: 'user' as const, content: prompt }],
      (d) => { out += d },
      undefined,
      undefined,
      { maxTokens: 600 },
    )
    return out
  }
  return callAiLocal(prompt, mode, [])
}

export { sleep }
