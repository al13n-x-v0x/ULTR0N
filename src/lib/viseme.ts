/**
 * Visemes — the Mark-LIV lip-sync technique, adapted:
 * mouth shapes derived from the TEXT (lips close on m/b/p, spread on i/e,
 * round on u/o) and TIMED by SpeechSynthesis boundary events (or a fallback
 * metronome when the engine gives none). ~30 shapes/sec of pure geometry,
 * no assets, no network.
 */

export type VisemeId =
  | 'closed'   // m, b, p — lips together
  | 'openWide' // a, ah — jaw drop, wide
  | 'openMid'  // e, eh
  | 'round'    // o, u, w
  | 'wide'     // i, ee
  | 'teeth'    // f, v — teeth on lip
  | 'neutral'  // rest / consonants without a distinct shape
  | 'kiss'     // oo, q-ish rounding

const CHAR_MAP: Record<string, VisemeId> = {
  m: 'closed', b: 'closed', p: 'closed',
  f: 'teeth', v: 'teeth',
  w: 'round', o: 'round', u: 'round',
  q: 'kiss',
  i: 'wide', y: 'wide', e: 'openMid',
  a: 'openWide',
}

/** Reduce any Latin-ish char to a bare letter and map to a viseme. */
export function visemeForChar(ch: string): VisemeId {
  const c = ch.toLowerCase()
  if (CHAR_MAP[c]) return CHAR_MAP[c]
  if (c >= 'a' && c <= 'z') {
    // heuristic for unmapped letters
    if ('cdgjknrstxz'.includes(c)) return 'neutral'
    if ('lh'.includes(c)) return 'openMid'
    return 'openMid'
  }
  return 'neutral'
}

/** Split a sentence into timed viseme frames (fallback when no boundary events). */
export interface VisemeFrame { viseme: VisemeId; tMs: number; durMs: number }

export function visemeTimeline(text: string, totalMs: number): VisemeFrame[] {
  const chars = [...text.replace(/\s+/g, ' ')]
  if (chars.length === 0) return []
  // weight: vowels/consonants get longer slots
  const weights = chars.map((c) => (/[aeiouy]/i.test(c) ? 1.35 : /[mbpfv]/i.test(c) ? 0.8 : c === ' ' ? 0.9 : 1))
  const total = weights.reduce((a, b) => a + b, 0)
  const frames: VisemeFrame[] = []
  let t = 0
  for (let i = 0; i < chars.length; i++) {
    const dur = (weights[i] / total) * totalMs
    frames.push({ viseme: visemeForChar(chars[i]), tMs: t, durMs: dur })
    t += dur
  }
  return frames
}

/** Shape parameters a renderer draws from. */
export interface MouthShape {
  open: number   // 0..1 jaw drop
  width: number  // 0..1 lip spread
  round: number  // 0..1 lip rounding
}

export function shapeFor(v: VisemeId): MouthShape {
  switch (v) {
    case 'closed': return { open: 0.02, width: 0.5, round: 0.2 }
    case 'teeth': return { open: 0.22, width: 0.65, round: 0.1 }
    case 'round': return { open: 0.45, width: 0.25, round: 0.95 }
    case 'kiss': return { open: 0.2, width: 0.15, round: 1 }
    case 'wide': return { open: 0.28, width: 1, round: 0 }
    case 'openMid': return { open: 0.55, width: 0.7, round: 0.2 }
    case 'openWide': return { open: 0.95, width: 0.8, round: 0.1 }
    default: return { open: 0.08, width: 0.55, round: 0.25 }
  }
}

export function lerpShape(a: MouthShape, b: MouthShape, t: number): MouthShape {
  return {
    open: a.open + (b.open - a.open) * t,
    width: a.width + (b.width - a.width) * t,
    round: a.round + (b.round - a.round) * t,
  }
}
