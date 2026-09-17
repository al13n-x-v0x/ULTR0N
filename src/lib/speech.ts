/** Web Speech helpers — neural-grade TTS selection + continuous STT sessions. */

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export interface VoiceInfo {
  name: string
  lang: string
  localService: boolean
}

/** All installed TTS voices (async — voices load lazily in Chrome). */
export function listVoices(): VoiceInfo[] {
  if (!ttsAvailable()) return []
  return window.speechSynthesis.getVoices().map((v) => ({ name: v.name, lang: v.lang, localService: v.localService }))
}

export function onVoicesReady(cb: () => void): () => void {
  if (!ttsAvailable()) return () => {}
  const handler = () => cb()
  window.speechSynthesis.addEventListener('voiceschanged', handler)
  // Some browsers need a kick
  window.speechSynthesis.getVoices()
  return () => window.speechSynthesis.removeEventListener('voiceschanged', handler)
}

/** Pick the best installed voice: prefer requested name → en-US neural/Google/Microsoft Natural → any English. */
export function pickVoice(preferredName?: string): SpeechSynthesisVoice | null {
  if (!ttsAvailable()) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  if (preferredName) {
    const exact = voices.find((v) => v.name === preferredName)
    if (exact) return exact
  }
  const qualityRank = (v: SpeechSynthesisVoice): number => {
    const n = v.name.toLowerCase()
    if (n.includes('natural') || n.includes('neural')) return 5
    if (n.includes('google')) return 4
    if (n.includes('microsoft')) return 3
    if (v.localService) return 2
    return 1
  }
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  const pool = en.length > 0 ? en : voices
  return [...pool].sort((a, b) => qualityRank(b) - qualityRank(a))[0] ?? null
}

export function speak(text: string, rate = 1, preferredVoice?: string, onBoundary?: (charIndex: number) => void): void {
  if (!ttsAvailable()) return
  try {
    window.speechSynthesis.cancel()
    // Split into sentences for smoother cadence and early start
    const parts = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) ?? [text]
    for (const raw of parts) {
      const part = raw.trim()
      if (!part) continue
      const u = new SpeechSynthesisUtterance(part.slice(0, 300))
      u.rate = rate
      u.pitch = 1
      const v = pickVoice(preferredVoice)
      if (v) { u.voice = v; u.lang = v.lang }
      if (onBoundary) {
        u.onboundary = (e) => onBoundary(e.charIndex)
        u.onstart = () => onBoundary(0)
      }
      window.speechSynthesis.speak(u)
    }
  } catch { /* noop */ }
}

export function stopSpeaking(): void {
  if (ttsAvailable()) {
    try { window.speechSynthesis.cancel() } catch { /* noop */ }
  }
}

export function speakingNow(): boolean {
  return ttsAvailable() && window.speechSynthesis.speaking
}

/* ---------------- Speech recognition (STT) ---------------- */

interface SRAlternative { readonly transcript: string; readonly confidence: number }
interface SRResult { readonly isFinal: boolean; readonly length: number; item(i: number): SRAlternative; [i: number]: SRAlternative }
interface SRResultList { readonly length: number; item(i: number): SRResult; [i: number]: SRResult }
interface SREvent extends Event { readonly resultIndex: number; readonly results: SRResultList }
interface SRErrorEvent extends Event { readonly error: string }
interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: SRErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
}
type SRCtor = new () => SpeechRecognitionLike

function getSRCtor(): SRCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function recognitionSupported(): boolean {
  return !!getSRCtor()
}

export interface SttSession {
  stop: () => void
  /** Press-to-talk: end current utterance quickly. */
  mute: () => void
}

export interface SttHandlers {
  onPartial: (text: string) => void
  onFinal: (text: string) => void
  onStateChange?: (listening: boolean) => void
  onError?: (err: string) => void
}

/**
 * Continuous STT session — auto-restarts after each utterance so the assistant
 * can hold a hands-free conversation. Call stop() to end the session.
 */
export function startContinuousStt(lang: string | undefined, h: SttHandlers): SttSession | null {
  const Ctor = getSRCtor()
  if (!Ctor) {
    h.onError?.('Speech recognition is not supported in this browser. Use Chrome or Edge.')
    return null
  }
  let stopped = false
  let rec: SpeechRecognitionLike | null = null

  const spawn = () => {
    if (stopped) return
    rec = new Ctor()
    rec.lang = lang || navigator.language || 'en-US'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onstart = () => { h.onStateChange?.(true) }
    rec.onspeechstart = () => h.onStateChange?.(true)
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) {
          const t = r[0].transcript.trim()
          if (t) h.onFinal(t)
        } else {
          interim += r[0].transcript
        }
      }
      if (interim) h.onPartial(interim)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        stopped = true
        h.onError?.('Microphone permission denied. Enable it in your browser settings.')
        h.onStateChange?.(false)
        return
      }
      if (e.error !== 'no-speech' && e.error !== 'aborted') h.onError?.(`Mic: ${e.error}`)
    }
    rec.onend = () => {
      h.onStateChange?.(false)
      if (!stopped) {
        // Chrome ends the session periodically — restart to stay hands-free
        window.setTimeout(() => { if (!stopped) { try { rec?.start() } catch { /* race */ } } }, 220)
      }
    }
    try { rec.start() } catch (err) {
      h.onError?.(err instanceof Error ? err.message : 'Failed to start recognition')
    }
  }

  spawn()

  return {
    stop: () => {
      stopped = true
      try { rec?.stop() } catch { /* noop */ }
      h.onStateChange?.(false)
    },
    mute: () => {
      try { rec?.stop() } catch { /* noop */ }
    },
  }
}

/** One-shot dictation (fills the chat input). Returns a handle; null if unsupported. */
export function startRecognition(
  onResult: (transcript: string, isFinal: boolean) => void,
  onEnd: (err?: string) => void,
): { stop: () => void } | null {
  const Ctor = getSRCtor()
  if (!Ctor) {
    onEnd('Speech recognition is not supported in this browser. Use Chrome or Edge for voice input.')
    return null
  }
  const rec = new Ctor()
  rec.lang = navigator.language || 'en-US'
  rec.continuous = false
  rec.interimResults = true
  let gotFinal = false
  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) { gotFinal = true; onResult(r[0].transcript, true) } else interim += r[0].transcript
    }
    if (interim) onResult(interim, false)
  }
  rec.onerror = (e) => onEnd(e.error === 'not-allowed' ? 'Microphone permission denied. Enable it in your browser settings.' : `Mic error: ${e.error}`)
  rec.onend = () => { if (!gotFinal) onEnd() }
  try { rec.start() } catch (err) { onEnd(err instanceof Error ? err.message : 'Failed to start recognition'); return null }
  return { stop: () => { try { rec.stop() } catch { /* noop */ } } }
}
