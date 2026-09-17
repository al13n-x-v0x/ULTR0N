/**
 * Subtitles — SRT generation with honest timing.
 *
 * When the on-device (or remote) model narrates the caption, the caller can
 * timestamp each streamed chunk via SubtitleBuilder. When no narration exists,
 * we fall back to reading-speed pacing (2.8 words/sec, 1.2s minimum per cue) —
 * and we SAY which mode was used, because fake frame-accurate timing would be
 * dishonest.
 */
export interface SubtitleCue {
  startMs: number
  endMs: number
  text: string
}

/** Collect streamed text chunks into timestamped cues. */
export class SubtitleBuilder {
  private entries: { tMs: number; text: string }[] = []
  private t0 = performance.now()

  /** Call for every streamed delta during narration. */
  push(delta: string): void {
    if (!delta) return
    this.entries.push({ tMs: performance.now() - this.t0, text: delta })
  }

  /** Assemble cues from the stream timing. */
  finish(maxCharsPerCue = 84): SubtitleCue[] {
    const full = this.entries.map((e) => e.text).join('')
    if (!full.trim()) return []
    const cues: SubtitleCue[] = []
    let cursor = 0
    let idx = 0
    while (cursor < full.length) {
      const slice = full.slice(cursor, cursor + maxCharsPerCue)
      const lastSpace = slice.lastIndexOf(' ')
      const text = (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim()
      if (!text) { cursor += maxCharsPerCue; continue }
      // find the stream time when this segment began/ended
      let acc = 0
      let startMs = this.entries[0]?.tMs ?? 0
      let endMs = startMs + 1500
      for (const e of this.entries) {
        const next = acc + e.text.length
        if (acc <= cursor) startMs = e.tMs
        if (acc + e.text.length >= cursor + text.length) { endMs = Math.max(endMs, e.tMs + 600); break }
        acc = next
      }
      cues.push({ startMs, endMs: Math.max(endMs, startMs + 900), text })
      cursor += text.length
      idx++
    }
    // enforce monotonic, non-overlapping timings
    for (let i = 1; i < cues.length; i++) {
      if (cues[i].startMs < cues[i - 1].endMs) cues[i].startMs = cues[i - 1].endMs
      if (cues[i].endMs <= cues[i].startMs) cues[i].endMs = cues[i].startMs + 900
    }
    return cues
  }

  /** Estimated total duration from the stream (ms). */
  estimatedDuration(): number {
    const last = this.entries[this.entries.length - 1]
    return last ? last.tMs + 800 : 0
  }
}

/** Reading-speed fallback cues (no narration available). */
export function readingSpeedCues(text: string, wordsPerSec = 2.8, minCueMs = 1200): SubtitleCue[] {
  const words = text.split(/\s+/)
  const cues: SubtitleCue[] = []
  let start = 0
  for (let i = 0; i < words.length; i += 9) {
    const chunk = words.slice(i, i + 9).join(' ')
    const dur = Math.max(minCueMs, (chunk.split(/\s+/).length / wordsPerSec) * 1000)
    cues.push({ startMs: start, endMs: start + dur, text: chunk })
    start += dur
  }
  return cues
}

function srtTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const msPart = Math.floor(ms % 1000)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(msPart, 3)}`
}

export function toSrt(cues: SubtitleCue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.text}\n`)
    .join('\n')
}

/** Wrap long lines for soft legacy players. */
export function wrapCueText(text: string, max = 42): string {
  if (text.length <= max) return text
  const mid = text.lastIndexOf(' ', max)
  if (mid <= 0) return text
  return text.slice(0, mid) + '\n' + text.slice(mid + 1)
}
