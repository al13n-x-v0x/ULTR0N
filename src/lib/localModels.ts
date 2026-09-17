/**
 * U.L.T.R.0.N. local-model intelligence.
 *
 * On first launch we probe the laptop honestly (CPU threads, RAM, storage quota,
 * WebGPU) and recommend a model tier that FITS the machine — never a model that
 * would eat all RAM/storage. Download is explicit, streamed with real progress,
 * cached by the browser, and fully on-device afterwards (offline capable).
 */

export type Tier = 'low' | 'mid' | 'high'

export interface HardwareReport {
  threads: number
  ramGb: number | null          // null when device-memory is unavailable (Firefox/Safari)
  storageFreeGb: number | null  // null when quota cannot be read
  webgpu: boolean
  adapter?: string              // GPU description if revealed
  platform: string
}

export interface ModelSpec {
  id: string                    // WebLLM model id
  label: string
  tier: Tier
  sizeGb: number
  ramGb: number
  vramGb: number
  blurb: string
  /** Capability tags surfaced in the UI — users pick by what they need. */
  tags?: ('chat' | 'code' | 'reasoning' | 'fast')[]
}

/** Curated on-device catalog, smallest first. All quantized (q4f16) WebGPU builds — ids verified against the bundled WebLLM prebuilt list. */
export const CATALOG: ModelSpec[] = [
  { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', label: 'SmolLM2 · 360M', tier: 'low', sizeGb: 0.4, ramGb: 2, vramGb: 1, tags: ['chat', 'fast'], blurb: 'Tiny but shockingly coherent — zero-warmup replies on any machine.' },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 0.5B', tier: 'low', sizeGb: 0.6, ramGb: 2, vramGb: 1, tags: ['chat', 'fast'], blurb: 'Featherweight — instant replies, simple tasks, near-zero footprint.' },
  { id: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen Coder · 0.5B', tier: 'low', sizeGb: 0.6, ramGb: 2, vramGb: 1, tags: ['code', 'fast'], blurb: 'The smallest real code model — completions and snippets, instant.' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 · 1B', tier: 'low', sizeGb: 0.9, ramGb: 3, vramGb: 1.5, tags: ['chat'], blurb: 'Fast general chat with solid instruction following.' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 1.5B', tier: 'mid', sizeGb: 1.3, ramGb: 4, vramGb: 2, tags: ['chat', 'fast'], blurb: 'Great speed/quality balance — the everyday driver.' },
  { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', label: 'SmolLM2 · 1.7B', tier: 'mid', sizeGb: 1.6, ramGb: 4, vramGb: 2, tags: ['chat', 'reasoning'], blurb: 'HuggingFace\'s small wonder — punches far above its size.' },
  { id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen Coder · 1.5B', tier: 'mid', sizeGb: 1.3, ramGb: 4, vramGb: 2, tags: ['code'], blurb: 'Serious coding in a small footprint — the dev-laptop default.' },
  { id: 'DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC', label: 'DeepSeek R1 · 1.5B distill', tier: 'mid', sizeGb: 1.3, ramGb: 4, vramGb: 2, tags: ['reasoning'], blurb: 'Chain-of-thought specialist distilled from DeepSeek R1.' },
  { id: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC', label: 'Qwen Coder · 3B', tier: 'mid', sizeGb: 2.2, ramGb: 6, vramGb: 3, tags: ['code', 'reasoning'], blurb: 'Whole-file refactors and explanations — strong mid-tier coder.' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 · 3B', tier: 'mid', sizeGb: 2.2, ramGb: 6, vramGb: 3, tags: ['chat'], blurb: 'Noticeably smarter; still light on a mid-range laptop.' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi 3.5 · mini', tier: 'high', sizeGb: 2.6, ramGb: 8, vramGb: 4, tags: ['reasoning', 'chat'], blurb: 'Microsoft\'s compact reasoning specialist.' },
  { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 7B', tier: 'high', sizeGb: 4.6, ramGb: 10, vramGb: 6, tags: ['chat', 'reasoning'], blurb: 'Deep reasoning for capable machines with 8GB+ VRAM.' },
  { id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC', label: 'Qwen Coder · 7B', tier: 'high', sizeGb: 4.6, ramGb: 10, vramGb: 6, tags: ['code', 'reasoning'], blurb: 'The heavyweight coder — near-cloud quality, still on-device.' },
]

/** Probe the machine. Reads only what browsers expose — no guessing. */
export async function probeHardware(): Promise<HardwareReport> {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const threads = nav.hardwareConcurrency ?? 4
  const ramGb = typeof nav.deviceMemory === 'number' ? Math.round(nav.deviceMemory) : null

  let storageFreeGb: number | null = null
  try {
    const est = await navigator.storage?.estimate?.()
    if (est?.quota) storageFreeGb = Math.round((est.quota / 1024 ** 3) * 10) / 10
  } catch { /* unavailable */ }

  let webgpu = false
  let adapter: string | undefined
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
    if (gpu) {
      const a = (await gpu.requestAdapter()) as { info?: { description?: string; vendor?: string } } | null
      if (a) {
        webgpu = true
        adapter = a.info?.description || a.info?.vendor || 'WebGPU adapter'
      }
    }
  } catch { /* WebGPU unavailable */ }

  return { threads, ramGb, storageFreeGb, webgpu, adapter, platform: navigator.platform }
}

/** Score the machine into a tier. Conservative: mid hardware gets mid models. */
export function recommendTier(h: HardwareReport): { tier: Tier; reason: string } {
  if (!h.webgpu) {
    return { tier: 'low', reason: 'No WebGPU — only the smallest CPU-friendly tiers are viable; on-device chat will fall back to text-only heuristics.' }
  }
  const ram = h.ramGb ?? 8 // conservative default when deviceMemory is hidden
  if (ram >= 16 && h.threads >= 8) return { tier: 'high', reason: `Strong machine — ${ram}GB RAM class, ${h.threads} threads, WebGPU ready. It can carry a 7B-class model.` }
  if (ram >= 8) return { tier: 'mid', reason: `Balanced machine — ~${ram}GB RAM, ${h.threads} threads. A 1.5–3B model is the sweet spot: smart without starving the system.` }
  return { tier: 'low', reason: `Light machine — ~${ram}GB RAM detected. Sub-1B models keep everything responsive.` }
}

export function modelsForTier(tier: Tier): ModelSpec[] {
  const order: Tier[] = tier === 'high' ? ['high', 'mid', 'low'] : tier === 'mid' ? ['mid', 'low', 'high'] : ['low', 'mid', 'high']
  return [...CATALOG].sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier))
}

export function fitsMachine(m: ModelSpec, h: HardwareReport): { ok: boolean; why?: string } {
  if (!h.webgpu) return { ok: false, why: 'WebGPU unavailable in this browser — try Chrome/Edge.' }
  if (h.ramGb !== null && m.ramGb > h.ramGb) return { ok: false, why: `Needs ~${m.ramGb}GB RAM; device reports ~${h.ramGb}GB.` }
  if (h.storageFreeGb !== null && m.sizeGb * 1.35 > h.storageFreeGb) return { ok: false, why: `Needs ~${(m.sizeGb * 1.35).toFixed(1)}GB free storage; quota reports ${h.storageFreeGb}GB.` }
  return { ok: true }
}

/* ---------------- Engine (lazy, single instance) ---------------- */

export type LoadPhase = 'idle' | 'fetching' | 'compiling' | 'ready' | 'error'

export interface LoadProgress {
  phase: LoadPhase
  progress: number      // 0..1
  text: string
  error?: string
}

type Listener = (p: LoadProgress) => void
const listeners = new Set<Listener>()
let engineInstance: import('@mlc-ai/web-llm').MLCEngineInterface | null = null
let engineModelId: string | null = null
/** Shared in-flight load so concurrent callers (boot warm-up + first message) coalesce. */
let loadPromise: Promise<void> | null = null

export function onModelProgress(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function emit(p: LoadProgress) { listeners.forEach((l) => l(p)) }

export function engineReady(): boolean {
  return !!engineInstance && engineModelId !== null
}
export function activeModelId(): string | null {
  return engineModelId
}

/** Download + compile the model. Streams real fetch/compile progress.
 * Concurrent calls for the same model coalesce into one load — no races. */
export async function loadModel(modelId: string): Promise<void> {
  if (engineReady() && engineModelId === modelId) return
  if (loadPromise) {
    await loadPromise
    if (engineReady() && engineModelId === modelId) return
  }

  emit({ phase: 'fetching', progress: 0, text: 'Connecting to model CDN…' })
  loadPromise = (async () => {
    try {
      const useId = await remapForDevice(modelId)
      const webllm = await import('@mlc-ai/web-llm')
      const engine = await webllm.CreateMLCEngine(useId, {
        initProgressCallback: (r) => {
          const p = Math.max(0, Math.min(1, r.progress ?? 0))
          const phase: LoadPhase = /shader|compile|finish/i.test(r.text) ? 'compiling' : 'fetching'
          emit({ phase, progress: p, text: r.text })
        },
      })
      engineInstance = engine
      engineModelId = useId
      emit({ phase: 'ready', progress: 1, text: 'Model ready — running fully on-device.' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      emit({ phase: 'error', progress: 0, text: 'Load failed', error: msg })
      throw err
    } finally {
      loadPromise = null
    }
  })()
  await loadPromise
}

/**
 * GPU capability probe: does this adapter support 16-bit float shaders?
 * Intel iGPUs often DON'T — the q4f16 builds fail WGSL compilation
 * ("extension 'f16' is not allowed"). We detect and remap to q4f32 builds.
 */
let f16Cache: boolean | null = null
export async function supportsF16(): Promise<boolean> {
  if (f16Cache !== null) return f16Cache
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<{ features?: Set<string> } | null> } }).gpu
    if (!gpu) { f16Cache = false; return false }
    const adapter = await gpu.requestAdapter()
    f16Cache = !!adapter?.features?.has?.('shader-f16')
  } catch { f16Cache = false }
  return f16Cache
}

/** Map f16 model builds to f32 equivalents on GPUs that lack shader-f16. */
export async function remapForDevice(modelId: string): Promise<string> {
  if (await supportsF16()) return modelId
  const f32 = modelId.replace(/q4f16_1-MLC$/, 'q4f32_1-MLC').replace(/q0f16-MLC$/, 'q0f32-MLC')
  return f32
}

/**
 * Auto-recovery: after a page reload the engine is gone from memory but the
 * weights are still in the browser cache — reload from cache (fast, no CDN)
 * instead of erroring. Falls back with a clear message if truly unavailable.
 */
export async function ensureEngine(preferredModelId?: string): Promise<true> {
  if (engineReady()) return true
  const modelId = preferredModelId ?? engineModelId
  if (!modelId) throw new Error('No on-device model installed — run /setup to download one.')
  try {
    await loadModel(modelId)
    return true
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    // Compatibility failures must read as compatibility failures — the setup
    // wizard's model list already hides incompatible builds.
    if (/GPU|adapter|f16|shader|device/i.test(raw)) {
      throw new Error(`This GPU can't run "${modelId}" (WebGPU: ${raw.slice(0, 120)}). Open /setup and pick a q4f32_1 or q0f32 build for your hardware.`)
    }
    throw new Error(`Model "${modelId}" could not be loaded from cache (${raw.slice(0, 140)}). Run /setup to reinstall it.`)
  }
}

/** Stop an in-flight generation immediately (WebLLM keeps tokenizing otherwise). */
export async function interruptGeneration(): Promise<void> {
  try { await engineInstance?.interruptGenerate() } catch { /* noop */ }
}

/** Drop the engine entirely — used when the GPU context dies and must be rebuilt. */
export async function resetEngine(): Promise<void> {
  try { await engineInstance?.unload() } catch { /* noop */ }
  engineInstance = null
  engineModelId = null
  loadPromise = null
}

export interface ChatTurn { role: 'user' | 'assistant' | 'system'; content: string }

const SYS = 'You are U.L.T.R.0.N. (Unified Logic, Tactical Reasoning & Zero-Point Network), an on-device AI built by AL13N INDUSTRIES. Be helpful, precise and concise.'

/** Stream a completion from the loaded on-device model. */
export async function chatLocalModel(
  turns: ChatTurn[],
  onDelta: (chunk: string) => void,
  signal?: { cancelled: boolean },
  systemPrompt?: string,
  opts?: { maxTokens?: number },
): Promise<void> {
  if (!engineInstance) throw new Error('No model loaded — run setup first.')
  const messages = [{ role: 'system' as const, content: systemPrompt ?? SYS }, ...turns]
  const chunks = await engineInstance.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.6,
    max_tokens: opts?.maxTokens ?? 700,
  })
  for await (const chunk of chunks) {
    if (signal?.cancelled) return
    const delta = chunk.choices[0]?.delta?.content ?? ''
    if (delta) onDelta(delta)
  }
}

/** Detect an existing Ollama install (local bridge on :11434). */
export async function detectOllama(): Promise<{ ok: boolean; models: string[]; error?: string }> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1500) })
    if (!res.ok) return { ok: false, models: [], error: `Bridge responded ${res.status}` }
    const j = (await res.json()) as { models?: { name: string }[] }
    return { ok: true, models: (j.models ?? []).map((m) => m.name) }
  } catch (err) {
    return { ok: false, models: [], error: err instanceof Error ? err.message : 'No local bridge found' }
  }
}
