import { useUi } from '../../store/uiStore'
import { useAi } from '../../store/aiStore'
import { useData } from '../../store/dataStore'
import { useSettings } from '../../store/settingsStore'
import { Icon, type IconName } from '../Icon'
import { IconButton, Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { StatusDot } from '../ui/StatusDot'
import type { Mode } from '../../types'

const MODE_LIST: { id: Mode; label: string; icon: IconName }[] = [
  { id: 'auto', label: 'Auto', icon: 'spark' },
  { id: 'reason', label: 'Reason', icon: 'brain' },
  { id: 'research', label: 'Deep Research', icon: 'globe' },
  { id: 'vision', label: 'Vision', icon: 'eye' },
  { id: 'code', label: 'Code', icon: 'code' },
  { id: 'create', label: 'Create', icon: 'palette' },
  { id: 'plan', label: 'Plan', icon: 'target' },
  { id: 'focus', label: 'Focus', icon: 'mode' },
  { id: 'study', label: 'Study', icon: 'brain' },
  { id: 'developer', label: 'Developer', icon: 'grid' },
]

export function ControlsDock() {
  const rightTab = useUi((s) => s.rightTab)
  const setRightTab = useUi((s) => s.setRightTab)
  const closeDock = useUi((s) => s.setRightDock)
  const settings = useSettings((s) => s.settings)
  const set = useSettings((s) => s.set)
  const mode = useAi((s) => s.mode)
  const devices = useData((s) => s.devices)
  const connected = devices.filter((d) => d.status === 'connected')

  const TABS: { id: 'controls' | 'devices' | 'camera' | 'phone'; label: string; icon: IconName }[] = [
    { id: 'controls', label: 'Controls', icon: 'grid' },
    { id: 'devices', label: 'Devices', icon: 'radar' },
    { id: 'camera', label: 'Camera', icon: 'camera' },
    { id: 'phone', label: 'Phone', icon: 'phone' },
  ]

  return (
    <aside
      aria-label="Dock"
      style={{
        width: 288, flex: 'none', display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid var(--line)', background: 'rgba(6, 10, 18, 0.55)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <div style={{ display: 'flex', padding: '10px 10px 0', gap: 4, borderBottom: '1px solid var(--line)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setRightTab(t.id)}
            title={t.label}
            aria-label={t.label}
            style={{
              flex: 1, height: 32, borderRadius: '9px 9px 0 0', display: 'grid', placeItems: 'center',
              color: rightTab === t.id ? 'var(--cyan)' : 'var(--text-low)',
              borderBottom: `2px solid ${rightTab === t.id ? 'var(--cyan)' : 'transparent'}`,
              transition: 'color 130ms ease, border-color 130ms ease',
            }}
          >
            <Icon name={t.icon} width={15} />
          </button>
        ))}
        <IconButton icon="close" title="Close dock" onClick={() => closeDock('closed')} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {rightTab === 'controls' && (
          <div className="anim-fade-up">
            <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 8 }}>Active Mode</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 16 }}>
              {MODE_LIST.map((m) => (
                <button
                  key={m.id}
                  onClick={() => useAi.getState().setMode(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
                    fontSize: 12, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
                    color: mode === m.id ? '#cffcff' : 'var(--text-mid)',
                    background: mode === m.id ? 'var(--cyan-soft)' : 'rgba(148,184,255,0.04)',
                    border: `1px solid ${mode === m.id ? 'rgba(34,211,238,0.4)' : 'var(--line)'}`,
                    transition: 'all 120ms ease',
                  }}
                >
                  <Icon name={m.icon} width={13} />
                  <span className="ellipsis">{m.label}</span>
                  {mode === m.id && <span className="dot dot--ok" style={{ marginLeft: 'auto', width: 5, height: 5 }} />}
                </button>
              ))}
            </div>

            <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 8 }}>System Toggles</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <DockToggle icon="volume" label="UI sounds" on={settings.uiSounds} set={(v) => set('uiSounds', v)} />
              <DockToggle icon="speaker" label="Voice reply" on={settings.voiceReply} set={(v) => set('voiceReply', v)} />
              <DockToggle icon="zap" label="Animations" on={settings.motion} set={(v) => set('motion', v)} />
              <DockToggle icon="brain" label="Auto-memorize" on={settings.autoMemorize} set={(v) => set('autoMemorize', v)} />
            </div>
          </div>
        )}

        {rightTab === 'devices' && (
          <div className="anim-fade-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="t-cap" style={{ color: 'var(--text-faint)' }}>Connected · {connected.length}</span>
              <Button size="sm" icon="radar" onClick={() => useUi.getState().setView('devices')}>Radar</Button>
            </div>
            {devices.length === 0 ? (
              <div className="empty" style={{ padding: 26 }}>
                <Icon name="radar" width={26} />
                <div className="empty-title">No devices scanned</div>
                <div className="empty-sub">Run a scan in Devices to discover nearby hardware.</div>
              </div>
            ) : connected.length === 0 ? (
              <div className="empty" style={{ padding: 26 }}>
                <Icon name="wifi" width={26} />
                <div className="empty-title">Nothing connected</div>
                <div className="empty-sub">Devices were found but none are connected yet.</div>
              </div>
            ) : (
              devices.filter((d) => d.status === 'connected').map((d) => (
                <div key={d.id} className="row" style={{ padding: '9px 10px' }}>
                  <span className="row__icon"><Icon name={d.icon as IconName} /></span>
                  <div className="row__main">
                    <span className="row__title" style={{ fontSize: 12.5 }}>{d.name}</span>
                    <span className="row__sub">{d.kind}</span>
                  </div>
                  <StatusDot tone={d.status === 'connected' ? 'ok' : 'idle'} />
                </div>
              ))
            )}
          </div>
        )}

        {rightTab === 'camera' && <DockCamera />}
        {rightTab === 'phone' && <DockPhone />}
      </div>
    </aside>
  )
}

function DockToggle({ icon, label, on, set }: { icon: IconName; label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="row" style={{ padding: '8px 10px' }}>
      <span className="row__icon" style={{ width: 30, height: 30 }}><Icon name={icon} width={14} /></span>
      <span className="row__title" style={{ fontSize: 12.5, flex: 1 }}>{label}</span>
      <Toggle on={on} onChange={set} label={label} />
    </div>
  )
}

function DockCamera() {
  return (
    <div className="anim-fade-up">
      <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 8 }}>Camera</div>
      <div className="empty" style={{ padding: 26 }}>
        <Icon name="camera" width={26} />
        <div className="empty-title">Camera off</div>
        <div className="empty-sub">Nothing is captured until you open the Vision view and allow access.</div>
        <Button size="sm" variant="primary" icon="power" onClick={() => { useUi.getState().setView('vision') }}>Open Vision</Button>
      </div>
    </div>
  )
}

function DockPhone() {
  return (
    <div className="anim-fade-up">
      <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 8 }}>Phone</div>
      <div className="empty" style={{ padding: 26 }}>
        <Icon name="phone" width={26} />
        <div className="empty-title">No phone linked</div>
        <div className="empty-sub">Link a phone in Phone Control to enable remote actions.</div>
        <Button size="sm" variant="primary" icon="link" onClick={() => useUi.getState().setView('phone')}>Open Phone Control</Button>
      </div>
    </div>
  )
}
