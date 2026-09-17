import { useEffect } from 'react'
import { useUi } from '../../store/uiStore'
import { Icon } from '../Icon'

const ICONS = { success: 'check', error: 'alert', info: 'bell' } as const
const COLORS = {
  success: { c: 'var(--ok)', bg: 'var(--ok-soft)', b: 'rgba(52,211,153,0.35)' },
  error: { c: 'var(--err)', bg: 'var(--err-soft)', b: 'rgba(251,113,133,0.35)' },
  info: { c: 'var(--cyan)', bg: 'var(--cyan-soft)', b: 'rgba(34,211,238,0.35)' },
} as const

/** Transient toast feedback (success / error / info). */
export function ToastHost() {
  const toast = useUi((s) => s.toast)
  const clearToast = useUi((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(clearToast, 3400)
    return () => window.clearTimeout(t)
  }, [toast, clearToast])

  if (!toast) return null
  const ic = ICONS[toast.kind]
  const col = COLORS[toast.kind]

  return (
    <div
      role="status"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 360,
        display: 'flex', gap: 11, alignItems: 'flex-start',
        minWidth: 280, maxWidth: 380, padding: '13px 15px',
        background: 'rgba(12, 18, 32, 0.95)', border: '1px solid var(--line-strong)',
        borderRadius: 'var(--radius-l)', boxShadow: 'var(--shadow-pop)',
        animation: 'popIn 200ms cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', flex: 'none',
        background: col.bg, border: `1px solid ${col.b}`, color: col.c,
      }}>
        <Icon name={ic} width={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{toast.title}</div>
        {toast.body && <div className="t-xs t-mid" style={{ marginTop: 3, lineHeight: 1.5 }}>{toast.body}</div>}
      </div>
      <button onClick={clearToast} aria-label="Dismiss" style={{ color: 'var(--text-faint)', padding: 2 }}>
        <Icon name="close" width={13} />
      </button>
    </div>
  )
}
