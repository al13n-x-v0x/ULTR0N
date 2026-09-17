import { useEffect, useRef, useState } from 'react'
import { useAi } from '../store/aiStore'
import { useSettings } from '../store/settingsStore'
import type { AiState } from '../types'

const LABELS: Record<AiState, string> = {
  idle: 'IDLE', listening: 'LISTENING', thinking: 'THINKING', processing: 'PROCESSING',
  responding: 'RESPONDING', executing: 'EXECUTING', success: 'SUCCESS', warning: 'WARNING',
  error: 'ERROR', offline: 'OFFLINE',
}

const STATE_COLOR: Record<AiState, string> = {
  idle: '#22d3ee', listening: '#4f8cff', thinking: '#a78bfa', processing: '#22d3ee',
  responding: '#34d399', executing: '#fbbf24', success: '#34d399', warning: '#fbbf24',
  error: '#fb7185', offline: '#64748b',
}

/** Central animated core — pure CSS/transform animation, canvas only while listening. */
export function AiCore({ size = 320 }: { size?: number }) {
  const state = useAi((s) => s.state)
  const progress = useAi((s) => s.progress)
  const reduced = useSettings((s) => !s.settings.motion)
  const [micLevel, setMicLevel] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const color = STATE_COLOR[state]

  // Microphone-reactive ring while LISTENING (canvas runs only in this state)
  useEffect(() => {
    if (state !== 'listening' || reduced) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let t = 0
    const draw = () => {
      t += 0.035
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const bars = 64
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * Math.PI * 2
        const amp = (Math.sin(t * 2.1 + i * 0.55) * 0.5 + 0.5) * 0.55 + (Math.sin(t * 3.7 + i) * 0.5 + 0.5) * 0.3
        const len = 6 + amp * 16
        const r1 = 108, r2 = r1 + len
        ctx.beginPath()
        ctx.strokeStyle = `rgba(79, 140, 255, ${0.16 + amp * 0.3})`
        ctx.lineWidth = 2
        ctx.moveTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1)
        ctx.lineTo(w / 2 + Math.cos(a) * r2, h / 2 + Math.sin(a) * r2)
        ctx.stroke()
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [state, reduced])

  // Simulated mic level for the reactive ring (real analyser wired in Voice view)
  useEffect(() => {
    if (state !== 'listening') { setMicLevel(0); return }
    const id = window.setInterval(() => setMicLevel(0.5 + Math.random() * 0.5), 180)
    return () => window.clearInterval(id)
  }, [state])

  const busy = state === 'thinking' || state === 'processing' || state === 'responding' || state === 'executing'

  return (
    <div
      style={{
        position: 'relative', width: size, height: size, flex: 'none',
        display: 'grid', placeItems: 'center',
      }}
      role="img"
      aria-label={`U.L.T.R.0.N. core — ${LABELS[state]}`}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute', inset: -40, borderRadius: '50%', pointerEvents: 'none',
          background: `radial-gradient(circle, ${color}22 0%, transparent 62%)`,
          opacity: state === 'offline' ? 0.25 : state === 'listening' ? 1 : 0.7,
          transition: 'opacity 600ms ease',
          animation: reduced ? undefined : 'coreBreath 4.2s ease-in-out infinite',
        }}
      />

      {/* Orbital rings */}
      <div
        className={reduced ? '' : 'ring-spin'}
        style={{
          position: 'absolute', width: size * 0.98, height: size * 0.98, borderRadius: '50%',
          border: `1px solid ${color}2e`, borderTopColor: `${color}88`,
          transition: 'border-color 500ms ease',
        }}
      />
      <div
        className={reduced ? '' : 'ring-spin-rev'}
        style={{
          position: 'absolute', width: size * 0.78, height: size * 0.78, borderRadius: '50%',
          border: `1px dashed ${color}24`,
          transition: 'border-color 500ms ease',
        }}
      />
      <div
        className={reduced ? '' : 'ring-spin'}
        style={{
          position: 'absolute', width: size * 0.6, height: size * 0.6, borderRadius: '50%',
          border: `1px solid ${color}1c`, borderBottomColor: `${color}66`,
          transition: 'border-color 500ms ease',
          animationDuration: busy ? '4s' : '9s',
        }}
      />

      {/* Waveform canvas (listening only) */}
      {state === 'listening' && (
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      )}

      {/* Progress arc while executing/streaming */}
      {(state === 'executing' || progress > 0) && progress > 0 && (
        <svg style={{ position: 'absolute', width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle
            cx="50%" cy="50%" r="47%" fill="none"
            stroke={color} strokeOpacity={0.75} strokeWidth={2.5} strokeLinecap="round"
            strokeDasharray={`${progress * 2 * Math.PI * 0.47} ${2 * Math.PI * 0.47}`}
            style={{ transition: 'stroke-dasharray 300ms cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>
      )}

      {/* Nucleus */}
      <div
        style={{
          width: size * 0.42, height: size * 0.42, borderRadius: '50%',
          position: 'relative',
          background: `radial-gradient(circle at 38% 32%, ${color}46, ${color}14 55%, transparent 75%), #060a13`,
          border: `1px solid ${color}55`,
          boxShadow: `0 0 ${state === 'listening' ? 42 : 24}px ${color}30, inset 0 0 30px ${color}18`,
          display: 'grid', placeItems: 'center',
          transform: `scale(${1 + micLevel * 0.04})`,
          transition: 'transform 160ms ease, box-shadow 400ms ease, border-color 400ms ease',
        }}
      >
        <svg width={size * 0.19} height={size * 0.19} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${color}90)` }}>
          <path d="M12 2 L22 20 L2 20 Z" />
          <path d="M12 9 L17.5 19 L6.5 19 Z" fill={`${color}30`} />
        </svg>
        {/* Inner energy shimmer */}
        {!reduced && (
          <div style={{
            position: 'absolute', inset: 6, borderRadius: '50%',
            background: `conic-gradient(from 0deg, transparent, ${color}30, transparent 32%)`,
            animation: 'coreSpin 3.4s linear infinite',
            opacity: busy ? 1 : 0.45,
          }} />
        )}
      </div>

      {/* Particle dots on outer ring */}
      {!reduced && (
        <>
          <OrbitDot size={size * 0.98} dur={11} color={color} />
          <OrbitDot size={size * 0.98} dur={17} reverse color={color} />
        </>
      )}

      {/* State label */}
      <div
        style={{
          position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 7,
          fontFamily: 'var(--font-display)', fontSize: 10.5, letterSpacing: '0.22em',
          color, textShadow: `0 0 12px ${color}60`,
          transition: 'color 400ms ease',
        }}
      >
        <span className={`dot dot--${state === 'error' ? 'err' : state === 'offline' ? 'idle' : state === 'warning' ? 'warn' : 'ok'} ${busy ? 'dot--pulse' : ''}`} />
        {LABELS[state]}
      </div>
    </div>
  )
}

function OrbitDot({ size, dur, reverse, color }: { size: number; dur: number; reverse?: boolean; color: string }) {
  return (
    <div
      style={{
        position: 'absolute', width: size, height: size, borderRadius: '50%',
        animation: `coreSpin ${dur}s linear infinite ${reverse ? 'reverse' : ''}`,
      }}
    >
      <span
        style={{
          position: 'absolute', top: -2.5, left: '50%', marginLeft: -2.5,
          width: 5, height: 5, borderRadius: '50%', background: color,
          boxShadow: `0 0 10px ${color}`,
        }}
      />
    </div>
  )
}
