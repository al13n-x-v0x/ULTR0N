import { useUi } from '../store/uiStore'
import { Modal } from './ui/Modal'
import { SHORTCUTS } from './SettingsModal'
import { Icon } from './Icon'

export function ShortcutsModal() {
  const open = useUi((s) => s.shortcutsOpen)
  const setOpen = useUi((s) => s.setShortcutsOpen)
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" subtitle="Work anywhere in U.L.T.R.0.N." icon="kbd" width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="row">
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-mid)' }}>{s.label}</span>
            <span style={{ display: 'flex', gap: 4 }}>
              {s.keys.split('+').map((k) => <span key={k} className="kbd">{k}</span>)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, color: 'var(--text-faint)', fontSize: 12 }}>
        <Icon name="info" width={14} />
        Shortcuts use Ctrl on Windows/Linux. Allow a beat for focus to return to the app after closing popups.
      </div>
    </Modal>
  )
}
