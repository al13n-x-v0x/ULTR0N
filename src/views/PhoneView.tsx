import { useState } from 'react'
import { useUi } from '../store/uiStore'
import { Icon, type IconName } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { ToggleRow } from '../components/ui/Toggle'
import { StatusBadge } from '../components/ui/StatusDot'

interface Action {
  id: string
  label: string
  icon: IconName
  state: 'available' | 'unavailable' | 'permission' | 'unsupported'
  reason: string
}

const REASONS = {
  unavailable: 'Unavailable — no phone is linked to this console.',
  permission: 'Requires permission — grant access on the paired device first.',
  unsupported: 'Not supported — this browser cannot issue that command.',
  disconnected: 'Device disconnected — link a phone to continue.',
} as const

/**
 * Phone Control panel.
 *
 * Honesty contract: until a real device link exists (e.g. an ADB/WebSocket bridge
 * or KDE-Connect-style daemon), every action renders as disabled with a truthful
 * reason. No fabricated status, battery or signal numbers.
 */
export function PhoneView() {
  const pushToast = useUi((s) => s.pushToast)
  const [attempts, setAttempts] = useState(0)

  const actions: Action[] = [
    { id: 'apps', label: 'Open Apps', icon: 'grid', state: 'unavailable', reason: REASONS.unavailable },
    { id: 'notifs', label: 'Notifications', icon: 'bell', state: 'unavailable', reason: REASONS.unavailable },
    { id: 'messages', label: 'Messages', icon: 'chat', state: 'unavailable', reason: REASONS.unavailable },
    { id: 'files', label: 'Files', icon: 'folder', state: 'unavailable', reason: REASONS.unavailable },
    { id: 'media', label: 'Media', icon: 'play', state: 'unavailable', reason: REASONS.unavailable },
    { id: 'location', label: 'Location', icon: 'target', state: 'permission', reason: REASONS.permission },
    { id: 'camera', label: 'Camera', icon: 'camera', state: 'permission', reason: REASONS.permission },
    { id: 'screenshot', label: 'Screenshot', icon: 'monitor', state: 'unavailable', reason: REASONS.unavailable },
    { id: 'mirror', label: 'Mirror Screen', icon: 'switchCam', state: 'unsupported', reason: REASONS.unsupported },
    { id: 'ring', label: 'Ring Phone', icon: 'bell', state: 'unavailable', reason: REASONS.disconnected },
  ]

  const linkPhone = () => {
    setAttempts((a) => a + 1)
    pushToast({
      title: 'No bridge detected',
      body: 'Linking requires a device bridge (ADB over TCP/IP or a companion daemon). U.L.T.R.0.N. will not pretend otherwise.',
      kind: 'info',
    })
  }

  return (
    <div className="anim-fade-up" style={{ padding: '22px 24px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span className="row__icon"><Icon name="phone" /></span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>Phone Control</h2>
          <div className="t-xs t-low">Capability-aware remote actions — disabled unless a real link exists</div>
        </div>
        <StatusBadge tone="idle">NOT LINKED</StatusBadge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Device card */}
        <div className="panel" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{
              width: 46, height: 46, borderRadius: 13, display: 'grid', placeItems: 'center',
              background: 'rgba(148,184,255,0.05)', border: '1px solid var(--line)', color: 'var(--text-faint)',
            }}>
              <Icon name="phone" width={22} />
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-mid)' }}>No device linked</div>
              <div className="t-xs t-low">Awaiting a genuine pairing</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            {[['Connection', '—'], ['Battery', '—'], ['Signal', '—'], ['Method', '—']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span className="t-low">{k}</span>
                <span className="mono t-low">{v}</span>
              </div>
            ))}
          </div>

          <Button variant="primary" icon="link" onClick={linkPhone} style={{ width: '100%' }}>
            {attempts > 0 ? 'RETRY LINK CHECK' : 'LINK A PHONE'}
          </Button>

          <div className="t-xs t-low" style={{ marginTop: 12, lineHeight: 1.55 }}>
            Supported bridges: ADB (USB/TCP), KDE Connect protocol, or a custom WebSocket companion app. Once a bridge reports itself, capabilities activate here automatically.
          </div>
        </div>

        {/* Actions grid */}
        <div className="panel" style={{ padding: 14 }}>
          <div className="t-cap" style={{ color: 'var(--text-faint)', padding: '2px 6px 10px' }}>Remote Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {actions.map((a) => (
              <button
                key={a.id}
                disabled
                title={a.reason}
                aria-label={`${a.label} (${a.reason})`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                  padding: 12, borderRadius: 12, textAlign: 'left',
                  background: 'rgba(148,184,255,0.03)', border: '1px solid var(--line)',
                  cursor: 'not-allowed', opacity: 0.55,
                }}
              >
                <Icon name={a.icon} width={17} style={{ color: 'var(--text-low)' }} />
                <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-mid)' }}>{a.label}</span>
                <span className="badge badge--muted" style={{ fontSize: 9 }}>
                  {a.state === 'unavailable' ? 'UNAVAILABLE' : a.state === 'permission' ? 'REQUIRES PERMISSION' : 'NOT SUPPORTED'}
                </span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <ToggleRow
              title="Allow remote actions when linked"
              sub="Once a bridge is present, these actions become live — with per-action confirmation for destructive ones."
              icon="shield"
              on={true}
              onChange={() => pushToast({ title: 'Always on', body: 'Remote actions only run with an explicit tap per action.', kind: 'info' })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
