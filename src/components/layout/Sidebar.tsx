import { useUi } from '../../store/uiStore'
import { Icon, type IconName } from '../Icon'

const NAV: { id: string; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'projects', label: 'Projects', icon: 'layers' },
  { id: 'voice', label: 'Voice', icon: 'mic' },
  { id: 'vision', label: 'Vision', icon: 'eye' },
  { id: 'research', label: 'Research', icon: 'globe' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'devices', label: 'Devices', icon: 'radar' },
  { id: 'phone', label: 'Phone Control', icon: 'phone' },
  { id: 'automations', label: 'Automations', icon: 'bolt' },
  { id: 'memory', label: 'Memory', icon: 'brain' },
  { id: 'code', label: 'Code', icon: 'code' },
  { id: 'tools', label: 'Tools', icon: 'grid' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const view = useUi((s) => s.view)
  const setView = useUi((s) => s.setView)

  const activeIndex = Math.max(0, NAV.findIndex((n) => n.id === view))

  return (
    <nav
      aria-label="Primary"
      style={{
        width: collapsed ? 68 : 232, flex: 'none',
        display: 'flex', flexDirection: 'column', gap: 2,
        padding: '12px 10px', overflowY: 'auto', overflowX: 'hidden',
        transition: 'width 220ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {NAV.map((item, i) => {
        const active = view === item.id
        return (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className="nav-item"
            data-active={active}
            style={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
              height: 38, padding: collapsed ? '0 0 0 24px' : '0 12px', borderRadius: 10,
              color: active ? 'var(--text-hi)' : 'var(--text-mid)', fontWeight: 500, fontSize: 13,
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'color 130ms ease, background 130ms ease',
            }}
          >
            {active && (
              <span
                className="nav-indicator"
                style={{
                  position: 'absolute', left: -10, width: 3, height: 18, borderRadius: 99,
                  background: 'var(--cyan)', boxShadow: '0 0 10px rgba(34,211,238,0.7)',
                  animation: `navSlide-${activeIndex} ${Math.min(Math.abs(i - activeIndex) * 40 + 140, 260)}ms cubic-bezier(0.16,1,0.3,1)`,
                }}
              />
            )}
            <Icon name={item.icon} width={17} style={{ filter: active ? 'drop-shadow(0 0 6px rgba(34,211,238,0.6))' : undefined }} />
            {!collapsed && <span className="ellipsis">{item.label}</span>}
          </button>
        )
      })}
      <style>{`
        .nav-item:hover { background: rgba(148,184,255,0.07); color: var(--text-hi) !important; }
        .nav-item[data-active='true'] { background: linear-gradient(90deg, rgba(34,211,238,0.12), rgba(34,211,238,0.03)); }
        @keyframes navSlide-${activeIndex} { from { transform: translateY(${(0 - activeIndex) * 38}px) scale(0.7); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
      `}</style>
    </nav>
  )
}
