import { useUi } from '../store/uiStore'
import { useSettings } from '../store/settingsStore'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { ToggleRow } from '../components/ui/Toggle'

const CARDS: { icon: string; title: string; sub: string; section: string }[] = [
  { icon: 'palette', title: 'Appearance', sub: 'Motion · glass · accent · density', section: 'appearance' },
  { icon: 'spark', title: 'AI provider', sub: 'Local core or OpenAI-compatible API', section: 'ai' },
  { icon: 'mic', title: 'Voice', sub: 'Speech output, rate, wake word', section: 'voice' },
  { icon: 'radar', title: 'Devices', sub: 'Discovery permissions', section: 'devices' },
  { icon: 'shield', title: 'Privacy', sub: 'Telemetry and memorization', section: 'privacy' },
  { icon: 'bell', title: 'Notifications', sub: 'Alert sources', section: 'notifications' },
]

export function SettingsView() {
  const setSettingsOpen = useUi((s) => s.setSettingsOpen)
  const setSection = useUi((s) => s.setSettingsSection)
  const settings = useSettings((s) => s.settings)
  const set = useSettings((s) => s.set)

  const openSection = (s: string) => { setSection(s); setSettingsOpen(true) }

  return (
    <div className="anim-fade-up" style={{ padding: '22px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div className="view-head">
        <span className="row__icon"><Icon name="settings" /></span>
        <div style={{ flex: 1 }}>
          <h2>Settings</h2>
          <div className="t-xs t-low">Open a layer for the full set — 13 sections, applied instantly</div>
        </div>
        <Button variant="primary" icon="settings" onClick={() => openSection('general')}>Open all settings</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {CARDS.map((c) => (
          <button key={c.title} className="panel wiki-card" onClick={() => openSection(c.section)} style={{ padding: 16 }}>
            <span className="row__icon" style={{ marginBottom: 10 }}><Icon name={c.icon as never} /></span>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.title}</div>
            <div className="t-xs t-low" style={{ marginTop: 3, lineHeight: 1.5 }}>{c.sub}</div>
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 14, padding: 6 }}>
        <ToggleRow title="Animations" sub="Global motion toggle (also in Appearance)" icon="zap" on={settings.motion} onChange={(v) => set('motion', v)} />
        <ToggleRow title="Glass panels" sub="Backdrop blur across the shell" icon="layers" on={settings.glass} onChange={(v) => set('glass', v)} />
        <ToggleRow title="Focus mode" sub="Hide sidebar and dock for deep work" icon="target" on={settings.focusMode} onChange={(v) => set('focusMode', v)} />
      </div>
    </div>
  )
}
