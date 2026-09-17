import { useEffect, useRef, useState } from 'react'
import { useUi } from '../store/uiStore'
import { useData } from '../store/dataStore'
import { Icon } from './Icon'
import { Button } from './ui/Button'

const KIND_META: Record<string, { icon: Parameters<typeof Icon>[0]['name']; color: string; bg: string }> = {
  device: { icon: 'radar', color: 'var(--cyan)', bg: 'var(--cyan-soft)' },
  task: { icon: 'check', color: 'var(--ok)', bg: 'var(--ok-soft)' },
  automation: { icon: 'bolt', color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  download: { icon: 'download', color: '#9cc0ff', bg: 'var(--blue-soft)' },
  warning: { icon: 'alert', color: 'var(--warn)', bg: 'var(--warn-soft)' },
  message: { icon: 'chat', color: '#9cc0ff', bg: 'var(--blue-soft)' },
  system: { icon: 'spark', color: 'var(--cyan)', bg: 'var(--cyan-soft)' },
}

export function NotificationsPanel() {
  const open = useUi((s) => s.notifOpen)
  const setOpen = useUi((s) => s.setNotifOpen)
  const notifs = useData((s) => s.notifs)
  const markAllRead = useData((s) => s.markAllRead)
  const markRead = useData((s) => s.markRead)
  const clearNotifs = useData((s) => s.clearNotifs)
  const askConfirm = useUi((s) => s.askConfirm)
  const pushToast = useUi((s) => s.pushToast)
  const ref = useRef<HTMLDivElement | null>(null)
  const [render, setRender] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setRender(true)
      const t = window.setTimeout(() => setShown(true), 15)
      return () => window.clearTimeout(t)
    }
    setShown(false)
    const t = window.setTimeout(() => setRender(false), 180)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (ref.current && !ref.current.contains(t) && !t.closest('[title="Notifications"]') && !t.closest('[aria-label="Notifications"]')) setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('mousedown', onDown) }
  }, [open, setOpen])

  if (!render) return null

  const unread = notifs.filter((n) => !n.read).length

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 270, pointerEvents: 'none' }}>
      <div
        ref={ref}
        role="region"
        aria-label="Notifications"
        style={{
          position: 'absolute', top: 60, right: 14, width: 380, maxHeight: 'min(560px, calc(100vh - 84px))',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(10, 15, 27, 0.96)', border: '1px solid var(--line-strong)',
          borderRadius: 'var(--radius-l)', boxShadow: 'var(--shadow-pop)',
          transform: shown ? 'translateY(0) translateX(0)' : 'translateY(-14px) translateX(10px)',
          opacity: shown ? 1 : 0,
          transition: 'transform 210ms cubic-bezier(0.16,1,0.3,1), opacity 210ms cubic-bezier(0.16,1,0.3,1)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderBottom: '1px solid var(--line)' }}>
          <Icon name="bell" width={16} style={{ color: 'var(--cyan)' }} />
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>Notifications</span>
          {unread > 0 && <span className="badge badge--info">{unread} new</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Button size="sm" variant="ghost" onClick={markAllRead}>Mark read</Button>
            <Button size="sm" variant="ghost" onClick={() => askConfirm({
              title: 'Clear all notifications?',
              message: 'This removes the full notification history. It cannot be undone.',
              confirmLabel: 'Clear',
              danger: true,
              onConfirm: () => { clearNotifs(); pushToast({ title: 'Notifications cleared', kind: 'success' }) },
            })}>Clear</Button>
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {notifs.length === 0 ? (
            <div className="empty" style={{ padding: 34 }}>
              <Icon name="bell" width={26} />
              <div className="empty-title">All clear</div>
              <div className="empty-sub">New alerts will land here — tasks, devices, automations.</div>
            </div>
          ) : notifs.map((n) => {
            const meta = KIND_META[n.kind] ?? KIND_META.system
            return (
              <div
                key={n.id}
                style={{
                  display: 'flex', gap: 11, padding: '11px 12px', borderRadius: 12, marginBottom: 4,
                  border: `1px solid ${n.read ? 'transparent' : 'rgba(34,211,238,0.2)'}`,
                  background: n.read ? 'transparent' : 'rgba(34,211,238,0.045)',
                  transition: 'background 130ms ease',
                }}
              >
                <span style={{
                  width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flex: 'none',
                  background: meta.bg, border: '1px solid var(--line)', color: meta.color,
                }}>
                  <Icon name={meta.icon} width={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: n.read ? 'var(--text-mid)' : 'var(--text-hi)' }}>{n.title}</span>
                    <span className="t-xs" style={{ color: 'var(--text-faint)', marginLeft: 'auto', flex: 'none' }}>
                      {fmtTime(n.ts)}
                    </span>
                  </div>
                  {n.body && <div className="t-sm" style={{ color: 'var(--text-low)', marginTop: 2, lineHeight: 1.45 }}>{n.body}</div>}
                  {!n.read && (
                    <button className="t-xs" style={{ color: 'var(--cyan)', marginTop: 5 }} onClick={() => markRead(n.id)}>
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function fmtTime(ts: number): string {
  const d = Date.now() - ts
  if (d < 60_000) return 'now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString()
}
