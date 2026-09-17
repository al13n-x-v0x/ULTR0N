import { useEffect, useState } from 'react'
import { useUi } from '../../store/uiStore'
import { Button } from './Button'
import { Icon } from '../Icon'

/** Destructive-action confirmation dialog, wired to uiStore.confirm. */
export function ConfirmHost() {
  const confirm = useUi((s) => s.confirm)
  const closeConfirm = useUi((s) => s.closeConfirm)
  const [render, setRender] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (confirm.open) {
      setRender(true)
      const t = window.setTimeout(() => setShown(true), 15)
      return () => window.clearTimeout(t)
    }
    setShown(false)
    const t = window.setTimeout(() => setRender(false), 170)
    return () => window.clearTimeout(t)
  }, [confirm.open])

  useEffect(() => {
    if (!confirm.open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeConfirm() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [confirm.open, closeConfirm])

  if (!render) return null

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={confirm.title}
      style={{
        position: 'fixed', inset: 0, zIndex: 340, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(2,4,8,0.55)', backdropFilter: `blur(${shown ? 8 : 0}px)`, WebkitBackdropFilter: `blur(${shown ? 8 : 0}px)`,
        opacity: shown ? 1 : 0, transition: 'opacity 170ms cubic-bezier(0.16,1,0.3,1)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeConfirm() }}
    >
      <div
        style={{
          width: 400, maxWidth: 'calc(100vw - 40px)',
          background: 'rgba(12, 18, 32, 0.96)', border: '1px solid var(--line-strong)',
          borderRadius: 'var(--radius-l)', boxShadow: 'var(--shadow-pop)', padding: 20,
          transform: shown ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.96)',
          transition: 'transform 190ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{
            width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', flex: 'none',
            background: confirm.danger ? 'var(--err-soft)' : 'var(--warn-soft)',
            border: `1px solid ${confirm.danger ? 'rgba(251,113,133,0.35)' : 'rgba(251,191,36,0.35)'}`,
            color: confirm.danger ? 'var(--err)' : 'var(--warn)',
          }}>
            <Icon name="alert" />
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>{confirm.title}</div>
            <div className="t-sm t-mid" style={{ marginTop: 6, lineHeight: 1.55 }}>{confirm.message}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <Button onClick={closeConfirm}>Cancel</Button>
          <Button
            variant={confirm.danger ? 'danger' : 'primary'}
            onClick={() => { confirm.onConfirm?.(); closeConfirm() }}
          >
            {confirm.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
