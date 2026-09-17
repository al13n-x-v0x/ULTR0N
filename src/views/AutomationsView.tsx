import { useState } from 'react'
import { useData } from '../store/dataStore'
import { useUi } from '../store/uiStore'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { Toggle } from '../components/ui/Toggle'
import { EmptyState } from '../components/ui/StatusDot'
import type { Automation } from '../types'

export function AutomationsView() {
  const automations = useData((s) => s.automations)
  const toggle = useData((s) => s.toggleAutomation)
  const add = useData((s) => s.addAutomation)
  const remove = useData((s) => s.removeAutomation)
  const pushNotif = useData((s) => s.pushNotif)
  const pushToast = useUi((s) => s.pushToast)
  const askConfirm = useUi((s) => s.askConfirm)
  const [running, setRunning] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const run = (a: Automation) => {
    if (running) return
    setRunning(a.id); setDone(null)
    window.setTimeout(() => {
      setRunning(null); setDone(a.id)
      pushNotif({ kind: 'automation', title: `Automation finished — ${a.name}`, body: a.action })
      window.setTimeout(() => setDone((d) => (d === a.id ? null : d)), 1800)
    }, 1400)
  }

  return (
    <div className="anim-fade-up" style={{ padding: '22px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span className="row__icon"><Icon name="bolt" /></span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>Automations</h2>
          <div className="t-xs t-low">Routines that run locally — triggers, actions, confirmations</div>
        </div>
        <Button variant="primary" icon="plus" onClick={() => add('New automation')}>New automation</Button>
      </div>

      {automations.length === 0 ? (
        <div className="panel"><EmptyState icon="bolt" title="No automations yet" sub="Create a routine to chain triggers and actions." /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {automations.map((a) => (
            <div key={a.id} className="panel" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="row__icon" style={{
                background: a.enabled ? 'var(--cyan-soft)' : 'rgba(148,184,255,0.05)',
                borderColor: a.enabled ? 'rgba(34,211,238,0.4)' : 'var(--line)',
              }}>
                <Icon name={done === a.id ? 'check' : 'bolt'} style={{ color: done === a.id ? 'var(--ok)' : undefined }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  value={a.name}
                  onChange={(e) => useData.setState({ automations: automations.map((x) => (x.id === a.id ? { ...x, name: e.target.value } : x)) })}
                  style={{ background: 'transparent', border: 'none', outline: 'none', fontWeight: 600, fontSize: 13.5, width: '100%', color: 'var(--text-hi)' }}
                  aria-label="Automation name"
                />
                <div className="t-xs t-low" style={{ display: 'flex', gap: 8, marginTop: 1 }}>
                  <span>{a.trigger}</span>·<span className="ellipsis">{a.action}</span>
                </div>
                {running === a.id && <div className="progress" style={{ marginTop: 7 }}><div className="progress-bar" /></div>}
              </div>
              {a.enabled ? (
                <Button size="sm" icon={done === a.id ? 'check' : 'play'} onClick={() => run(a)} disabled={running !== null}>
                  {running === a.id ? 'Running…' : done === a.id ? 'Done' : 'Run'}
                </Button>
              ) : (
                <Button size="sm" disabled title="Enable to run">Run</Button>
              )}
              <Toggle on={a.enabled} onChange={() => toggle(a.id)} label={`${a.name} enabled`} />
              <Button
                size="sm" variant="ghost" icon="trash"
                onClick={() => askConfirm({
                  title: `Delete "${a.name}"?`,
                  message: 'This automation and its trigger config will be removed.',
                  confirmLabel: 'Delete',
                  danger: true,
                  onConfirm: () => { remove(a.id); pushToast({ title: 'Automation deleted', kind: 'success' }) },
                })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
