import { useEffect, useRef, useState } from 'react'

export function levelOf(v: number): 'ok' | 'warn' | 'err' {
  return v >= 90 ? 'err' : v >= 75 ? 'warn' : 'ok'
}

interface MeterProps {
  label: string
  value: number
  unit?: string
  icon?: string
}

/** Smoothly animated linear meter — numbers ease toward targets via rAF. */
export function Meter({ label, value, unit = '%', icon }: MeterProps) {
  const [display, setDisplay] = useState(value)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const from = display
    const to = value
    if (from === to) return
    const start = performance.now()
    const dur = 550
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (to - from) * eased)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const lvl = levelOf(value)
  return (
    <div className="meter">
      <div className="meter-top">
        <span className="t-mid">{label}</span>
        <span className="val">{Math.round(display)}{unit}</span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" data-level={lvl} style={{ width: `${display}%` }} />
      </div>
      {icon ? <span className="sr-only">{icon}</span> : null}
    </div>
  )
}

interface RingProps {
  value: number
  size?: number
  stroke?: number
  label?: string
  sub?: string
}

/** SVG ring gauge with animated dash offset. */
export function Ring({ value, size = 64, stroke = 5, label, sub }: RingProps) {
  const [display, setDisplay] = useState(value)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const from = display
    const to = value
    if (from === to) return
    const start = performance.now()
    const dur = 600
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (to - from) * eased)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const lvl = levelOf(value)
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg className="ring" width={size} height={size}>
        <defs>
          <linearGradient id={`ringGrad-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#4f8cff" />
          </linearGradient>
        </defs>
        <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-fg"
          data-level={lvl}
          cx={size / 2} cy={size / 2} r={r} fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - display / 100)}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-mono)', fontSize: size >= 60 ? 13 : 11, fontWeight: 600,
      }}>
        {label ?? `${Math.round(display)}%`}
      </div>
      {sub && (
        <div style={{ position: 'absolute', bottom: -17, left: 0, right: 0, textAlign: 'center', fontSize: 10.5, color: 'var(--text-low)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}
