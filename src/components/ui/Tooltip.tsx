import { useEffect, useRef, useState, type ReactNode } from 'react'

interface TipProps {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}

/** Lightweight tooltip: hover + focus, short delay, transform-only animation. */
export function Tooltip({ label, children, side = 'top' }: TipProps) {
  const [show, setShow] = useState(false)
  const [ready, setReady] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (show) {
      const t = window.setTimeout(() => setReady(true), 10)
      return () => window.clearTimeout(t)
    }
    setReady(false)
  }, [show])

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const enter = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShow(true), 350)
  }
  const leave = () => {
    if (timer.current) window.clearTimeout(timer.current)
    setShow(false)
  }

  const pos =
    side === 'top' ? { bottom: 'calc(100% + 8px)', left: '50%', transform: `translateX(-50%) translateY(${ready ? 0 : 4}px)` }
    : side === 'bottom' ? { top: 'calc(100% + 8px)', left: '50%', transform: `translateX(-50%) translateY(${ready ? 0 : 4}px)` }
    : side === 'left' ? { right: 'calc(100% + 8px)', top: '50%', transform: `translateY(-50%) translateX(${ready ? 0 : 4}px)` }
    : { left: 'calc(100% + 8px)', top: '50%', transform: `translateY(-50%) translateX(${ready ? 0 : 4}px)` }

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          style={{
            ...pos,
            position: 'absolute',
            zIndex: 400,
            opacity: ready ? 1 : 0,
            transition: 'opacity 120ms cubic-bezier(0.16,1,0.3,1), transform 120ms cubic-bezier(0.16,1,0.3,1)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            fontSize: 11.5,
            fontWeight: 500,
            color: 'var(--text-hi)',
            background: 'rgba(10, 16, 28, 0.95)',
            border: '1px solid var(--line-strong)',
            borderRadius: 8,
            padding: '5px 9px',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          {label}
        </span>
      )}
    </span>
  )
}
