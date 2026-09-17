import { useEffect, useState } from 'react'
import { useUi } from '../../store/uiStore'
import { useData } from '../../store/dataStore'
import { bridgeHealth, type BridgeHealth } from '../../lib/bridge'
import { Icon } from '../Icon'
import { IconButton } from '../ui/Button'
import { StatusBadge } from '../ui/StatusDot'

export function TopBar({ sidebarCollapsed, onToggleSidebar }: { sidebarCollapsed: boolean; onToggleSidebar: () => void }) {
  const openPalette = useUi((s) => s.openPalette)
  const setNotifOpen = useUi((s) => s.setNotifOpen)
  const notifOpen = useUi((s) => s.notifOpen)
  const openQuick = useUi((s) => s.setQuickOpen)
  const openSettings = useUi((s) => s.setSettingsOpen)
  const openShortcuts = useUi((s) => s.setShortcutsOpen)
  const notifs = useData((s) => s.notifs)
  const unread = notifs.filter((n) => !n.read).length
  const [now, setNow] = useState(() => new Date())
  const [bridge, setBridge] = useState<BridgeHealth | null>(null)
  const [probing, setProbing] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  // Bridge liveness — poll every 20s so the dot reflects reality
  const probe = async () => {
    setProbing(true)
    setBridge(await bridgeHealth())
    setProbing(false)
  }
  useEffect(() => {
    void probe()
    const id = window.setInterval(() => void probe(), 20_000)
    return () => window.clearInterval(id)
  }, [])

  const bridgeColor = bridge?.ok ? (bridge.commandsEnabled ? 'var(--ok)' : 'var(--warn)') : 'var(--text-faint)'

  return (
    <header
      style={{
        height: 'var(--topbar-h)', flex: 'none', display: 'flex', alignItems: 'center', gap: 14,
        padding: '0 16px', borderBottom: '1px solid var(--line)',
        background: 'rgba(6, 10, 18, 0.65)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        position: 'relative', zIndex: 50,
      }}
    >
      {/* Brand + bridge status dot */}
      <button
        onClick={() => openQuick(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}
        title="U.L.T.R.0.N. quick menu"
        aria-label="Open quick menu"
      >
        <span style={{
          width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center',
          background: 'linear-gradient(135deg, rgba(34,211,238,0.16), rgba(79,140,255,0.1))',
          border: '1px solid rgba(34,211,238,0.35)', color: 'var(--cyan)',
          boxShadow: '0 0 14px rgba(34,211,238,0.18)',
        }}>
          <Icon name="logo" width={17} />
        </span>
        <span style={{ textAlign: 'left', lineHeight: 1.15 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="brand-type" style={{ fontSize: 13.5, display: 'block' }}>U.L.T.R.0.N.</span>
            <span
              onClick={(e) => { e.stopPropagation(); void probe() }}
              title={bridge?.ok
                ? `Bridge connected (${bridge.platform})${bridge.commandsEnabled ? '' : ' — commands disabled (no ULTRON_TOKEN)'}${bridge.youtubeConfigured ? ' · YouTube ready' : ''} — click to re-probe`
                : 'Bridge offline — laptop control & uploads need it (node bridge/ultron-bridge.mjs). Click to retry.'}
              style={{
                width: 8, height: 8, borderRadius: '50%', flex: 'none', cursor: 'pointer',
                background: bridgeColor,
                boxShadow: bridge?.ok ? `0 0 8px ${bridgeColor}` : 'none',
                border: '1px solid rgba(255,255,255,0.18)',
                opacity: probing ? 0.4 : 1,
                transition: 'opacity 200ms ease',
              }}
              aria-label={`Bridge status: ${bridge?.ok ? 'connected' : 'offline'}`}
            />
          </span>
          <span className="t-cap" style={{ fontSize: 8.5, color: 'var(--text-low)', display: 'block', letterSpacing: '0.22em' }}>AL13N Industries</span>
        </span>
      </button>

      {/* Global search trigger */}
      <button
        onClick={() => openPalette()}
        style={{
          flex: 1, maxWidth: 560, height: 36, display: 'flex', alignItems: 'center', gap: 10,
          margin: '0 auto', padding: '0 13px', borderRadius: 12,
          border: '1px solid var(--line)', background: 'rgba(5, 9, 17, 0.55)', color: 'var(--text-faint)',
          fontSize: 13, transition: 'border-color 130ms ease, background 130ms ease',
        }}
        aria-label="Open command palette (Ctrl+K)"
      >
        <Icon name="search" width={15} />
        <span style={{ flex: 1, textAlign: 'left' }}>Search or run a command…</span>
        <span className="kbd">Ctrl</span>
        <span className="kbd">K</span>
      </button>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
        <div className="t-sm mono" style={{ color: 'var(--text-mid)', textAlign: 'right', marginRight: 4, display: 'grid', lineHeight: 1.3 }}>
          <span>{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span style={{ color: 'var(--text-hi)' }}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        <StatusBadge tone="ok">Online</StatusBadge>

        <div style={{ position: 'relative' }}>
          <IconButton icon="bell" title="Notifications" active={notifOpen} onClick={() => setNotifOpen(!notifOpen)} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -2, minWidth: 15, height: 15, padding: '0 4px',
              borderRadius: 99, background: 'var(--cyan)', color: '#03131a',
              fontSize: 9.5, fontWeight: 700, display: 'grid', placeItems: 'center',
              boxShadow: '0 0 10px rgba(34,211,238,0.6)',
            }}>{unread}</span>
          )}
        </div>

        <IconButton icon="settings" title="Settings" onClick={() => openSettings(true)} />

        <span style={{ width: 1, height: 22, background: 'var(--line-strong)', margin: '0 4px' }} />

        {/* Operator profile */}
        <button
          onClick={() => { openSettings(true); useUi.getState().setSettingsSection('general') }}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 8px 4px 4px', borderRadius: 12, transition: 'background 130ms ease' }}
          aria-label="Operator profile"
        >
          <span style={{
            width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: 'linear-gradient(135deg, #16324a, #0d1b30)', border: '1px solid rgba(34,211,238,0.4)',
            color: 'var(--cyan)',
          }}>
            <Icon name="user" width={14} />
          </span>
          <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>AL13N</span>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--text-low)' }}>Operator</span>
          </span>
        </button>

        <IconButton icon={sidebarCollapsed ? 'chevR' : 'chevL'} title="Toggle sidebar" onClick={onToggleSidebar} />
        <IconButton icon="kbd" title="Shortcuts (Ctrl+/)" onClick={() => openShortcuts(true)} />
        <IconButton icon="window" title="Window controls" onClick={() => useUi.getState().pushToast({ title: 'Window controls', body: 'Native window controls are available in the desktop build (Electron/Tauri shell).', kind: 'info' })} />
      </div>
    </header>
  )
}
