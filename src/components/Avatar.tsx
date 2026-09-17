/**
 * Holographic avatar — canvas-drawn head that lip-syncs (mouth shapes from the
 * spoken text via viseme.ts), blinks, makes saccades between fixation points,
 * and acts as the assistant's status light: looks away while thinking, meets
 * your eyes while listening, glances down at new content, lids fall when idle.
 *
 * Deliberately a DIFFERENT art style from Mark-LIV's human head: a faceted
 * wireframe hologram in the shell's cyan language — low-poly planes, scan
 * shimmer, no attempt at a photoreal face.
 */
import { useEffect, useRef } from 'react'
import { shapeFor, lerpShape, visemeTimeline, type MouthShape, type VisemeFrame } from '../lib/viseme'
import type { AiState } from '../types'

export interface AvatarHandle {
  /** Begin lip-syncing this text for the given duration. */
  speak: (text: string, totalMs: number) => void
  /** Stop mouth movement (speech cancelled). */
  hush: () => void
}

interface Props {
  size?: number
  state: AiState
  reduced?: boolean
  onReady?: (h: AvatarHandle) => void
}

const STATE_GAZE: Record<AiState, { x: number; y: number; lid: number }> = {
  idle: { x: 0, y: 0, lid: 0.75 },          // lids fall
  listening: { x: 0, y: 0, lid: 0.12 },     // meet your eyes
  thinking: { x: -0.55, y: -0.2, lid: 0.45 }, // look away, brows down vibe
  processing: { x: 0.4, y: -0.3, lid: 0.5 },
  responding: { x: 0, y: 0.1, lid: 0.25 },
  executing: { x: 0.5, y: 0.35, lid: 0.4 },
  success: { x: 0, y: -0.1, lid: 0.2 },
  warning: { x: -0.3, y: 0.2, lid: 0.35 },
  error: { x: 0, y: 0, lid: 0.3 },
  offline: { x: 0, y: 0.4, lid: 0.95 },
}

export function Avatar({ size = 300, state, reduced = false, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef(state)
  const reducedRef = useRef(reduced)
  stateRef.current = state
  reducedRef.current = reduced

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    const cx = W / 2, cy = H / 2

    // ---- animation state ----
    let raf = 0
    let t0 = performance.now()
    let blinkT = -1 // ms into blink, -1 = not blinking
    let nextBlink = 1200 + Math.random() * 2600
    let gaze = { ...STATE_GAZE[stateRef.current] }
    let saccadeTarget = { x: 0, y: 0 }
    let nextSaccade = 900
    let mouth: MouthShape = { open: 0.08, width: 0.55, round: 0.25 }
    let mouthTarget: MouthShape = mouth
    let frames: VisemeFrame[] = []
    let framesStart = 0

    const handle: AvatarHandle = {
      speak: (text, totalMs) => {
        frames = visemeTimeline(text, totalMs)
        framesStart = performance.now()
      },
      hush: () => { frames = [] },
    }
    onReady?.(handle)

    const draw = (now: number) => {
      const t = (now - t0) / 1000
      const st = stateRef.current
      const reducedNow = reducedRef.current
      const base = st === 'error' ? '#fb7185' : st === 'warning' || st === 'executing' ? '#fbbf24' : st === 'success' ? '#34d399' : '#22d3ee'
      const accent = st === 'listening' || st === 'thinking' ? '#4f8cff' : base

      ctx.clearRect(0, 0, W, H)

      // ---- blink scheduler ----
      if (!reducedNow && blinkT < 0 && now - t0 > nextBlink) { blinkT = 0; nextBlink = now - t0 + 2200 + Math.random() * 3400 }
      let lidBlink = 0
      if (blinkT >= 0) {
        blinkT += 16.7
        const p = blinkT / 180
        if (p >= 1) { blinkT = -1 } else { lidBlink = Math.sin(p * Math.PI) }
      }

      // ---- saccades ----
      if (!reducedNow && now - t0 > nextSaccade) {
        nextSaccade = now - t0 + 700 + Math.random() * 1800
        const g = STATE_GAZE[st]
        saccadeTarget = { x: g.x + (Math.random() - 0.5) * 0.25, y: g.y + (Math.random() - 0.5) * 0.2 }
      }
      const g0 = STATE_GAZE[st]
      gaze.x += ((saccadeTarget.x || g0.x) - gaze.x) * 0.06
      gaze.y += ((saccadeTarget.y || g0.y) - gaze.y) * 0.06
      const lid = Math.min(1, g0.lid + lidBlink)

      // ---- mouth from viseme frames ----
      if (frames.length > 0) {
        const el = now - framesStart
        const f = frames.find((fr) => el >= fr.tMs && el < fr.tMs + fr.durMs) ?? frames[frames.length - 1]
        if (el > frames[frames.length - 1].tMs + frames[frames.length - 1].durMs) frames = []
        else mouthTarget = shapeFor(f.viseme)
      } else {
        mouthTarget = { open: 0.08, width: 0.55, round: 0.25 }
      }
      mouth = lerpShape(mouth, mouthTarget, 0.35)

      const breathe = reducedNow ? 0 : Math.sin(t * 1.1) * 2.2
      const sway = reducedNow ? 0 : Math.sin(t * 0.7) * 3
      const gx = gaze.x, gy = gaze.y

      // ---- hologram palette ----
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      // scan shimmer lines
      if (!reducedNow) {
        ctx.globalAlpha = 0.05
        ctx.strokeStyle = accent
        ctx.lineWidth = 1
        for (let y = 0; y < H; y += 7) {
          ctx.beginPath(); ctx.moveTo(0, y + ((t * 24) % 7)); ctx.lineTo(W, y + ((t * 24) % 7)); ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // head silhouette — faceted hologram planes
      const hw = W * 0.30, hh = H * 0.40
      const chin = cy + hh + breathe
      ctx.globalAlpha = 0.95
      ctx.strokeStyle = accent
      ctx.shadowColor = accent
      ctx.shadowBlur = 14

      // skull dome (arc) 
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(cx + sway * 0.3, cy - hh * 0.18 + breathe, hh * 0.78, Math.PI * 1.05, Math.PI * 1.95)
      ctx.stroke()

      // cheeks/jaw polyline
      ctx.beginPath()
      ctx.moveTo(cx - hh * 0.72, cy - hh * 0.12 + breathe)
      ctx.lineTo(cx - hw * 0.86, cy + hh * 0.22 + breathe)
      ctx.lineTo(cx - hw * 0.5, cy + hh * 0.62 + breathe)
      ctx.quadraticCurveTo(cx + sway * 0.3, chin + 6, cx + hw * 0.5, cy + hh * 0.62 + breathe)
      ctx.lineTo(cx + hw * 0.86, cy + hh * 0.22 + breathe)
      ctx.lineTo(cx + hh * 0.72, cy - hh * 0.12 + breathe)
      ctx.stroke()

      // facet seams
      ctx.lineWidth = 0.8
      ctx.globalAlpha = 0.35
      ctx.beginPath()
      ctx.moveTo(cx - hw * 0.4, cy - hh * 0.55 + breathe); ctx.lineTo(cx, cy - hh * 0.1 + breathe); ctx.lineTo(cx + hw * 0.4, cy - hh * 0.55 + breathe)
      ctx.moveTo(cx - hw * 0.72, cy + hh * 0.18 + breathe); ctx.lineTo(cx, cy + hh * 0.1 + breathe); ctx.lineTo(cx + hw * 0.72, cy + hh * 0.18 + breathe)
      ctx.stroke()

      // ---- eyes ----
      const eyeY = cy - hh * 0.16 + breathe
      const eyeDX = hw * 0.34
      const eyeR = hw * 0.16
      for (const s of [-1, 1]) {
        const ex = cx + s * eyeDX + sway * 0.3 + gx * 10
        const ey = eyeY + gy * 7
        // sclera diamond (hologram facet look)
        ctx.globalAlpha = 0.9
        ctx.strokeStyle = accent
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(ex, ey - eyeR); ctx.lineTo(ex + eyeR * 0.9, ey); ctx.lineTo(ex, ey + eyeR); ctx.lineTo(ex - eyeR * 0.9, ey); ctx.closePath()
        ctx.stroke()
        // lid
        if (lid > 0.05) {
          ctx.globalAlpha = Math.min(0.9, lid)
          ctx.fillStyle = '#050910'
          ctx.beginPath()
          ctx.moveTo(ex - eyeR, ey - eyeR); ctx.lineTo(ex + eyeR, ey - eyeR); ctx.lineTo(ex + eyeR, ey - eyeR + eyeR * 2 * lid); ctx.lineTo(ex - eyeR, ey - eyeR + eyeR * 2 * lid); ctx.closePath()
          ctx.fill()
        }
        // pupil glow
        ctx.globalAlpha = 0.9
        ctx.fillStyle = accent
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(ex + gx * 4, ey + gy * 3, 2.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 14
      }

      // ---- brows (ride the state) ----
      const browLift = st === 'thinking' ? -3 : st === 'listening' ? 2.5 : 0
      ctx.globalAlpha = 0.7
      ctx.lineWidth = 1.3
      for (const s of [-1, 1]) {
        const bx = cx + s * eyeDX + sway * 0.3 + gx * 6
        const by = eyeY - eyeR * 1.7 + browLift + gy * 4 + breathe
        ctx.beginPath()
        ctx.moveTo(bx - eyeR * 0.8, by + (s < 0 ? 1.5 : 0))
        ctx.lineTo(bx + eyeR * 0.8, by + (s < 0 ? 0 : 1.5))
        ctx.stroke()
      }

      // ---- nose hint ----
      ctx.globalAlpha = 0.4
      ctx.beginPath()
      ctx.moveTo(cx + sway * 0.3, eyeY + eyeR * 1.2)
      ctx.lineTo(cx + sway * 0.3 + gx * 5, cy + hh * 0.18 + breathe)
      ctx.stroke()

      // ---- mouth (the lip-sync) ----
      const mY = cy + hh * 0.42 + breathe + gy * 3
      const mW = hw * (0.28 + mouth.width * 0.3)
      const mOpen = mouth.open * hh * 0.16
      const mRound = mouth.round
      ctx.globalAlpha = 0.95
      ctx.strokeStyle = accent
      ctx.lineWidth = 1.8
      ctx.shadowBlur = 12
      ctx.beginPath()
      if (mRound > 0.6) {
        // rounded embouchure
        ctx.ellipse(cx + sway * 0.3 + gx * 6, mY, mW * (1 - mRound * 0.45), Math.max(2.5, mOpen + 2.5), 0, 0, Math.PI * 2)
      } else {
        ctx.moveTo(cx - mW + sway * 0.3 + gx * 6, mY)
        ctx.quadraticCurveTo(cx + sway * 0.3 + gx * 6, mY + mOpen * 1.6, cx + mW + sway * 0.3 + gx * 6, mY)
        ctx.quadraticCurveTo(cx + sway * 0.3 + gx * 6, mY - mOpen * 0.5, cx - mW + sway * 0.3 + gx * 6, mY)
      }
      ctx.stroke()
      // inner mouth glow while talking
      if (mouth.open > 0.3 && frames.length > 0) {
        ctx.globalAlpha = 0.35
        ctx.fillStyle = accent
        ctx.fill()
      }

      ctx.shadowBlur = 0
      ctx.globalAlpha = 1

      // ---- neck / collar base ----
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = accent
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx - hw * 0.42, cy + hh * 0.92 + breathe)
      ctx.lineTo(cx - hw * 0.3, cy + hh * 0.7 + breathe)
      ctx.moveTo(cx + hw * 0.42, cy + hh * 0.92 + breathe)
      ctx.lineTo(cx + hw * 0.3, cy + hh * 0.7 + breathe)
      ctx.stroke()
      ctx.globalAlpha = 1

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size }} role="img" aria-label={`U.L.T.R.0.N. holographic avatar — ${state}`} />
}
