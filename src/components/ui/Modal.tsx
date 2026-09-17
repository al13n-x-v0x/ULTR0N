import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { IconButton } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: string
  width?: number
  children: ReactNode
  footer?: ReactNode
}

/** Centered modal: ESC closes, backdrop click closes, smooth scale/fade both ways. */
export function Modal({ open, onClose, title, subtitle, icon, width = 680, children, footer }: ModalProps) {
  const [render, setRender] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setRender(true)
      const t = window.setTimeout(() => setShown(true), 15)
      return () => window.clearTimeout(t)
    }
    setShown(false)
    const t = window.setTimeout(() => setRender(false), 170)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!render) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(2, 4, 8, 0.6)',
        backdropFilter: `blur(${shown ? 10 : 0}px)`,
        WebkitBackdropFilter: `blur(${shown ? 10 : 0}px)`,
        opacity: shown ? 1 : 0,
        transition: 'opacity 180ms cubic-bezier(0.16,1,0.3,1), backdrop-filter 180ms cubic-bezier(0.16,1,0.3,1)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: `min(${width}px, calc(100vw - 48px))`,
          maxHeight: 'min(76vh, 860px)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(11, 17, 30, 0.92)',
          border: '1px solid var(--line-strong)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-pop)',
          transform: shown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.965)',
          opacity: shown ? 1 : 0,
          transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1), opacity 200ms cubic-bezier(0.16,1,0.3,1)',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 18px', borderBottom: '1px solid var(--line)' }}>
          {icon && (
            <span style={{
              width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center',
              background: 'var(--cyan-soft)', border: '1px solid rgba(34,211,238,0.3)', color: 'var(--cyan)', flex: 'none',
            }}>
              <Icon name={icon as never} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>{title}</div>
            {subtitle && <div className="t-xs t-low" style={{ marginTop: 1 }}>{subtitle}</div>}
          </div>
          <IconButton icon="close" onClick={onClose} title="Close (Esc)" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '13px 18px', borderTop: '1px solid var(--line)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
