import { useEffect, useRef, useState } from 'react'
import { useUi } from '../store/uiStore'
import { useAi } from '../store/aiStore'
import { useSettings } from '../store/settingsStore'
import { Icon, type IconName } from './Icon'
import { Toggle } from './ui/Toggle'
import type { Mode } from '../types'

interface Item {
  icon: IconName
  name: string
  desc: string
  kind: 'mode' | 'toggle' | 'action'
  value?: string
  shortcut?: string
  get?: () => boolean
  set?: (v: boolean) => void
  run?: () => void
}

export function QuickMenu() {
  const open = useUi((s) => s.quickOpen)
  const setOpen = useUi((s) => s.setQuickOpen)
  const mode = useAi((s) => s.mode)
  const settings = useSettings((s) => s.settings)
  const setSetting = useSettings((s) => s.set)
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('mousedown', onDown) }
  }, [open, setOpen])

  if (!render) return null

  const items: Item[] = [
    { icon: 'mic', name: 'Whisper Mode', desc: 'Private, quiet responses', kind: 'toggle', get: () => settings.whisper, set: (v) => setSetting('whisper', v), shortcut: 'W' },
    { icon: 'target', name: 'Focus Mode', desc: 'Minimal UI, max productivity', kind: 'toggle', get: () => settings.focusMode, set: (v) => setSetting('focusMode', v), shortcut: 'F' },
    { icon: 'brain', name: 'Study Mode', desc: 'Step-by-step learning replies', kind: 'mode', value: 'study' },
    { icon: 'spark', name: 'Creative Mode', desc: 'Bold, imaginative output', kind: 'mode', value: 'create' },
    { icon: 'code', name: 'Developer Mode', desc: 'Technical depth & tooling', kind: 'mode', value: 'developer' },
    { icon: 'eye', name: 'Vision Mode', desc: 'Camera & screen analysis', kind: 'mode', value: 'vision' },
    { icon: 'radar', name: 'Device Control', desc: 'Scan and manage the mesh', kind: 'action', run: () => useUi.getState().setView('devices') },
    { icon: 'phone', name: 'Phone Control', desc: 'Capability-aware phone actions', kind: 'action', run: () => useUi.getState().setView('phone') },
    { icon: 'camera', name: 'Camera', desc: 'Live capture panel', kind: 'action', run: () => { useUi.getState().setView('vision'); useUi.getState().setRightTab('camera') } },
    { icon: 'bolt', name: 'Automations', desc: 'Routines and triggers', kind: 'action', run: () => useUi.getState().setView('automations') },
    { icon: 'brain', name: 'Memory', desc: 'Long-term memory hub', kind: 'action', run: () => useUi.getState().setView('memory') },
    { icon: 'settings', name: 'Settings', desc: 'All system preferences', kind: 'action', run: () => { useUi.getState().setSettingsOpen(true); useUi.getState().setSettingsSection('general') }, shortcut: 'Ctrl+,' },
  ]

  const pick = (item: Item) => {
    if (item.kind === 'mode' && item.value) {
      useAi.getState().setMode(item.value as Mode)
      useUi.getState().pushToast({ title: `${item.name} engaged`, kind: 'success' })
      setOpen(false)
    } else if (item.kind === 'action') {
      item.run?.()
      setOpen(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 290,
        background: shown ? 'rgba(2,4,8,0.4)' : 'rgba(2,4,8,0)',
        backdropFilter: `blur(${shown ? 8 : 0}px)`, WebkitBackdropFilter: `blur(${shown ? 8 : 0}px)`,
        transition: 'background 190ms ease, backdrop-filter 190ms ease',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div
        ref={ref}
        role="menu"
        aria-label="Quick menu"
        style={{
          position: 'absolute', top: 56, left: 14, width: 330,
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
          background: 'rgba(10, 15, 27, 0.95)', border: '1px solid var(--line-strong)',
          borderRadius: 'var(--radius-l)', boxShadow: 'var(--shadow-pop)', padding: 6,
          transform: shown ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.97)',
          opacity: shown ? 1 : 0,
          transition: 'transform 190ms cubic-bezier(0.16,1,0.3,1), opacity 190ms cubic-bezier(0.16,1,0.3,1)',
          transformOrigin: 'top left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px 7px' }}>
          <Icon name="logo" width={15} style={{ color: 'var(--cyan)' }} />
          <span className="t-cap" style={{ color: 'var(--text-low)' }}>Quick Control</span>
          <span className="kbd" style={{ marginLeft: 'auto' }}>ESC</span>
        </div>
        {items.map((item) => {
          const isModeActive = item.kind === 'mode' && mode === item.value
          const toggled = item.kind === 'toggle' ? !!item.get?.() : false
          return (
            <button
              key={item.name}
              role="menuitem"
              onClick={() => (item.kind === 'toggle' ? item.set?.(!item.get?.()) : pick(item))}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
                padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                background: isModeActive ? 'var(--cyan-soft)' : 'transparent',
                transition: 'background 110ms ease',
              }}
              onMouseEnter={(e) => { if (!isModeActive) e.currentTarget.style.background = 'rgba(148,184,255,0.06)' }}
              onMouseLeave={(e) => { if (!isModeActive) e.currentTarget.style.background = isModeActive ? 'var(--cyan-soft)' : 'transparent' }}
            >
              <span style={{
                width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', flex: 'none',
                background: isModeActive || toggled ? 'var(--cyan-soft)' : 'rgba(148,184,255,0.06)',
                border: `1px solid ${isModeActive || toggled ? 'rgba(34,211,238,0.35)' : 'var(--line)'}`,
                color: isModeActive || toggled ? 'var(--cyan)' : 'var(--text-mid)',
              }}>
                <Icon name={item.icon} width={15} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-hi)' }}>{item.name}</span>
                  {isModeActive && <span className="badge badge--info">active</span>}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-low)' }} className="ellipsis">{item.desc}</span>
              </span>
              {item.shortcut && <span className="kbd">{item.shortcut}</span>}
              {item.kind === 'toggle' && <Toggle on={toggled} onChange={(v) => item.set?.(v)} label={item.name} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
