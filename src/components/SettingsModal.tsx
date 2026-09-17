import { useState } from 'react'
import { useUi } from '../store/uiStore'
import { useSettings } from '../store/settingsStore'
import { probeBridges, type BridgeReport } from '../lib/ai'
import { modelLabel } from '../lib/urx'
import { bridgeHealth, setBridgeToken, type BridgeHealth as LocalBridge } from '../lib/bridge'
import { skillsReport } from '../lib/skills'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { ToggleRow } from './ui/Toggle'
import { Icon } from './Icon'
import type { IconName } from './Icon'

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'general', label: 'General', icon: 'settings' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'ai', label: 'AI', icon: 'spark' },
  { id: 'voice', label: 'Voice', icon: 'mic' },
  { id: 'vision', label: 'Vision', icon: 'eye' },
  { id: 'devices', label: 'Devices', icon: 'radar' },
  { id: 'phone', label: 'Phone', icon: 'phone' },
  { id: 'privacy', label: 'Privacy', icon: 'shield' },
  { id: 'memory', label: 'Memory', icon: 'brain' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'keyboard', label: 'Keyboard', icon: 'kbd' },
  { id: 'performance', label: 'Performance', icon: 'zap' },
  { id: 'advanced', label: 'Bridge & Avatar', icon: 'grid' },
]

export function SettingsModal() {
  const open = useUi((s) => s.settingsOpen)
  const setOpen = useUi((s) => s.setSettingsOpen)
  const section = useUi((s) => s.settingsSection)
  const setSection = useUi((s) => s.setSettingsSection)
  const settings = useSettings((s) => s.settings)
  const set = useSettings((s) => s.set)
  const reset = useSettings((s) => s.reset)
  const askConfirm = useUi((s) => s.askConfirm)
  const pushToast = useUi((s) => s.pushToast)
  const [showKey, setShowKey] = useState(false)
  const [bridges, setBridges] = useState<BridgeReport | null>(null)
  const [probing, setProbing] = useState(false)
  const [localBridge, setLocalBridge] = useState<LocalBridge | null>(null)
  const [skillsView, setSkillsView] = useState('')

  const checkLocalBridge = async () => {
    setLocalBridge(await bridgeHealth())
    setSkillsView(skillsReport(await bridgeHealth()))
  }

  const runProbe = async () => {
    setProbing(true)
    try {
      setBridges(await probeBridges(useSettings.getState().settings))
    } finally {
      setProbing(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Settings"
      subtitle="Preferences apply instantly and persist locally"
      icon="settings"
      width={860}
      footer={
        <>
          <Button
            variant="danger"
            icon="refresh"
            onClick={() => askConfirm({
              title: 'Reset all settings?',
              message: 'Every preference returns to its default value. Memories are kept.',
              confirmLabel: 'Reset settings',
              danger: true,
              onConfirm: () => { reset(); pushToast({ title: 'Settings reset', kind: 'success' }) },
            })}
          >
            Reset defaults
          </Button>
          <Button variant="primary" icon="check" onClick={() => setOpen(false)}>Done</Button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '168px 1fr', gap: 18, minHeight: 440 }}>
        {/* Section rail */}
        <div style={{ borderRight: '1px solid var(--line)', paddingRight: 10 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                padding: '7px 10px', borderRadius: 9, marginBottom: 1, cursor: 'pointer',
                fontSize: 12.5, fontWeight: 500,
                color: section === s.id ? '#cffcff' : 'var(--text-mid)',
                background: section === s.id ? 'var(--cyan-soft)' : 'transparent',
                border: `1px solid ${section === s.id ? 'rgba(34,211,238,0.3)' : 'transparent'}`,
                transition: 'all 120ms ease',
              }}
            >
              <Icon name={s.icon} width={14} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Section body */}
        <div style={{ minWidth: 0 }}>
          {section === 'general' && (
            <Sec title="General" desc="Identity and shell behavior">
              <Field label="Display name" hint="How U.L.T.R.0.N. addresses you">
                <input className="input" style={{ maxWidth: 220 }} value={settings.displayName} onChange={(e) => set('displayName', e.target.value)} />
              </Field>
              <ToggleRow title="Sounds" sub="Subtle UI interaction sounds (where supported)" icon="volume" on={settings.uiSounds} onChange={(v) => set('uiSounds', v)} />
              <ToggleRow title="Compact sidebar" sub="Collapse navigation to icons only" icon="sidebar" on={settings.compactSidebar} onChange={(v) => set('compactSidebar', v)} />
            </Sec>
          )}

          {section === 'appearance' && (
            <Sec title="Appearance" desc="Motion, glass, accent, density">
              <ToggleRow title="Animations" sub="Smooth transitions and core motion" icon="zap" on={settings.motion} onChange={(v) => set('motion', v)} />
              <ToggleRow title="Glass panels" sub="Backdrop blur on panels (GPU cost)" icon="layers" on={settings.glass} onChange={(v) => set('glass', v)} />
              <ToggleRow title="Reduced effects" sub="Extra restraint: fewer glows and particles" icon="moon" on={settings.reducedEffects} onChange={(v) => set('reducedEffects', v)} />
              <Field label="Accent" hint="Primary highlight color">
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['cyan', 'blue', 'violet', 'emerald'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => set('accent', a)}
                      aria-label={a}
                      style={{
                        width: 30, height: 30, borderRadius: 9, cursor: 'pointer',
                        background: ACCENTS[a], border: settings.accent === a ? '2px solid #fff' : '1px solid var(--line-strong)',
                        boxShadow: settings.accent === a ? '0 0 12px rgba(34,211,238,0.4)' : undefined,
                      }}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Density" hint="Spacing scale across the app">
                <div className="seg">
                  {(['comfortable', 'compact'] as const).map((d) => (
                    <button key={d} data-active={settings.density === d} onClick={() => set('density', d)}>{d}</button>
                  ))}
                </div>
              </Field>
            </Sec>
          )}

          {section === 'ai' && (
            <Sec title="AI provider" desc="On-device model · light local core · remote API">
              <Field label="Provider" hint="Where replies are generated">
                <div className="seg">
                  <button data-active={settings.provider === 'webllm'} onClick={() => { if (settings.webllmModel) set('provider', 'webllm') }} title={settings.webllmModel ? settings.webllmModel : 'Download a model first'}>On-device</button>
                  <button data-active={settings.provider === 'local'} onClick={() => set('provider', 'local')}>Light core</button>
                  <button data-active={settings.provider === 'remote'} onClick={() => set('provider', 'remote')}>Remote API</button>
                </div>
              </Field>
              {settings.provider === 'webllm' && settings.webllmModel && (
                <div className="row">
                  <span className="row__icon"><Icon name="cpu" /></span>
                  <div className="row__main">
                    <span className="row__title mono" style={{ fontSize: 12.5 }}>{settings.webllmModel}</span>
                    <span className="row__sub">Runs on WebGPU in this browser · cached · offline-capable</span>
                  </div>
                  <span className="badge badge--ok">LOCAL</span>
                </div>
              )}
              <Button icon="cpu" onClick={() => set('setupDone', false)}>
                {settings.webllmModel ? `Manage / re-run model setup (active: ${modelLabel(settings.webllmModel)})` : 'Set up a local model'}
              </Button>
              <ToggleRow title="autoBuff" sub="Catch natural commands like “remember that…” or “switch to qwen coder” and turn them into ULX actions" icon="zap" on={settings.autoBuff} onChange={(v) => set('autoBuff', v)} />
              <Field label="Buff persona" hint="A directive primed into every reply (e.g. “Be blunt. Ship code, not prose.”)">
                <input
                  className="input" style={{ maxWidth: 340 }}
                  value={settings.buffPersona}
                  placeholder="optional persona note…"
                  onChange={(e) => set('buffPersona', e.target.value)}
                />
              </Field>
              <Field label="Connectivity" hint="Probe the remote endpoint and the Ollama bridge (localhost:11434)">
                <Button size="sm" icon="radar" onClick={() => void runProbe()} disabled={probing}>{probing ? 'Probing…' : 'Probe bridges'}</Button>
              </Field>
              {bridges && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 10, background: 'rgba(148,184,255,0.04)', border: '1px solid var(--line)' }}>
                  <div className="t-cap" style={{ color: 'var(--text-faint)' }}>Bridge report</div>
                  <div className="t-sm" style={{ color: bridges.remote.reachable ? 'var(--ok)' : 'var(--text-low)' }}>
                    • Remote API {settings.baseUrl}: {bridges.remote.reachable ? 'reachable' : `unreachable${bridges.remote.error ? ` (${bridges.remote.error})` : ''}`}
                  </div>
                  <div className="t-sm" style={{ color: bridges.ollama.up ? 'var(--ok)' : 'var(--text-low)' }}>
                    • Ollama bridge: {bridges.ollama.up ? `up — ${bridges.ollama.models.length} model(s): ${bridges.ollama.models.slice(0, 5).join(', ')}${bridges.ollama.models.length > 5 ? '…' : ''}` : `not detected${bridges.ollama.error ? ` (${bridges.ollama.error})` : ''}`}
                  </div>
                  <div className="t-xs t-low">Point Base URL at http://localhost:11434/v1 with an Ollama model name to run a local server as your remote provider.</div>
                </div>
              )}
              {settings.provider === 'remote' && (
                <>
                  <Field label="Base URL" hint="OpenAI-compatible chat completions endpoint">
                    <input className="input mono" style={{ maxWidth: 340 }} value={settings.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} />
                  </Field>
                  <Field label="Model" hint="e.g. gpt-4o-mini, llama3:latest (Ollama)">
                    <input className="input mono" style={{ maxWidth: 340 }} value={settings.model} onChange={(e) => set('model', e.target.value)} />
                  </Field>
                  <Field label="API key" hint="Stored only in this browser's localStorage">
                    <div style={{ display: 'flex', gap: 8, maxWidth: 340 }}>
                      <input
                        className="input mono" type={showKey ? 'text' : 'password'}
                        value={settings.apiKey} placeholder="sk-…"
                        onChange={(e) => set('apiKey', e.target.value)}
                      />
                      <Button icon="eye" onClick={() => setShowKey((v) => !v)}>{showKey ? 'Hide' : 'Show'}</Button>
                    </div>
                  </Field>
                  <Field label={`Temperature · ${settings.temperature.toFixed(1)}`} hint="Higher = more creative">
                    <input type="range" min={0} max={2} step={0.1} value={settings.temperature} onChange={(e) => set('temperature', Number(e.target.value))} style={{ width: 220, accentColor: '#22d3ee' }} />
                  </Field>
                  <Field label="Max tokens" hint="Response length cap">
                    <input className="input" type="number" style={{ maxWidth: 120 }} value={settings.maxTokens} onChange={(e) => set('maxTokens', Number(e.target.value) || 512)} />
                  </Field>
                </>
              )}
              <div className="badge badge--info" style={{ marginTop: 8 }}>Status: {settings.provider === 'local' ? 'local heuristic core (offline)' : settings.provider === 'webllm' ? 'on-device WebGPU model' : navigator.onLine ? 'remote · online' : 'remote · OFFLINE'}</div>
            </Sec>
          )}

          {section === 'voice' && (
            <Sec title="Voice" desc="Speech output and input">
              <ToggleRow title="Speak replies" sub="Read AI answers aloud via speech synthesis" icon="speaker" on={settings.voiceReply} onChange={(v) => set('voiceReply', v)} />
              <Field label={`Speech rate · ${settings.speechRate.toFixed(1)}×`} hint="Pace of spoken replies">
                <input type="range" min={0.6} max={1.6} step={0.1} value={settings.speechRate} onChange={(e) => set('speechRate', Number(e.target.value))} style={{ width: 220, accentColor: '#22d3ee' }} />
              </Field>
              <ToggleRow title="Wake word" sub="Ambient listening for 'Ultron' (requires mic permission)" icon="mic" on={settings.wakeWord} onChange={(v) => set('wakeWord', v)} />
            </Sec>
          )}

          {section === 'vision' && (
            <Sec title="Vision" desc="Camera and screen analysis permissions">
              <ToggleRow title="Camera on demand only" sub="Camera initializes only when you open the Vision view" icon="camera" on={true} onChange={() => pushToast({ title: 'Always on-demand', body: 'U.L.T.R.0.N. never opens the camera in the background.', kind: 'info' })} />
              <ToggleRow title="Auto-analyze captures" sub="Send captures to the AI core when taken" icon="spark" on={settings.autoMemorize} onChange={(v) => set('autoMemorize', v)} />
            </Sec>
          )}

          {section === 'devices' && (
            <Sec title="Devices" desc="Discovery and mesh behavior">
              <ToggleRow title="Allow device discovery" sub="Permit scanning for nearby devices when you run a scan" icon="radar" on={settings.deviceDiscovery} onChange={(v) => set('deviceDiscovery', v)} />
              <div className="badge badge--muted">Discovery is opt-in. U.L.T.R.0.N. never pairs or connects without your explicit action.</div>
            </Sec>
          )}

          {section === 'phone' && (
            <Sec title="Phone" desc="Phone-link capabilities">
              <div className="badge badge--muted" style={{ marginBottom: 10 }}>
                Phone actions depend on a real device link. Without one, actions show honest, disabled states.
              </div>
              <ToggleRow title="Require confirmation for ring" sub="Ask before ringing a linked phone" icon="bell" on={true} onChange={() => pushToast({ title: 'Always confirm', body: 'Ring actions always confirm first in this build.', kind: 'info' })} />
            </Sec>
          )}

          {section === 'privacy' && (
            <Sec title="Privacy" desc="What leaves this machine">
              <ToggleRow title="Usage telemetry" sub="Anonymous local counters — never uploaded" icon="activity" on={settings.telemetry} onChange={(v) => set('telemetry', v)} />
              <ToggleRow title="Auto-memorize context" sub="Save useful facts from conversations locally" icon="brain" on={settings.autoMemorize} onChange={(v) => set('autoMemorize', v)} />
              <div className="badge badge--ok">All data stays on this device · no analytics, no uploads</div>
            </Sec>
          )}

          {section === 'memory' && (
            <Sec title="Memory" desc="What U.L.T.R.0.N. remembers">
              <Button icon="brain" onClick={() => { setOpen(false); useUi.getState().setView('memory') }}>Open Memory Hub</Button>
              <div className="t-sm t-low" style={{ marginTop: 10, lineHeight: 1.6 }}>
                Memories live in browser localStorage under <code className="mono">ultron.memory.v1</code>. Clearing them is destructive and asks for confirmation first.
              </div>
            </Sec>
          )}

          {section === 'notifications' && (
            <Sec title="Notifications" desc="Alert sources">
              <ToggleRow title="System events" sub="Core status, diagnostics, updates" icon="activity" on={settings.notifSystem} onChange={(v) => set('notifSystem', v)} />
              <ToggleRow title="Device events" sub="Connections, pairing, battery" icon="radar" on={settings.notifDevices} onChange={(v) => set('notifDevices', v)} />
              <ToggleRow title="Task completions" sub="Automations, exports, scans" icon="check" on={settings.notifTasks} onChange={(v) => set('notifTasks', v)} />
            </Sec>
          )}

          {section === 'keyboard' && (
            <Sec title="Keyboard" desc="Every shortcut (also on Ctrl+/)">
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className="row" style={{ padding: '8px 10px' }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-mid)' }}>{s.label}</span>
                  <span style={{ display: 'flex', gap: 4 }}>
                    {s.keys.split('+').map((k) => <span key={k} className="kbd">{k}</span>)}
                  </span>
                </div>
              ))}
            </Sec>
          )}

          {section === 'performance' && (
            <Sec title="Performance" desc="Rendering and animation budget">
              <ToggleRow title="Animations" sub="Disable for maximum battery savings" icon="zap" on={settings.motion} onChange={(v) => set('motion', v)} />
              <ToggleRow title="Glass blur" sub="Backdrop filters cost GPU — disable on weak hardware" icon="layers" on={settings.glass} onChange={(v) => set('glass', v)} />
              <ToggleRow title="Reduced effects" sub="Minimum glow and particle work" icon="moon" on={settings.reducedEffects} onChange={(v) => set('reducedEffects', v)} />
              <div className="t-sm t-low" style={{ lineHeight: 1.6 }}>
                Only transform/opacity animate. Canvas effects run solely during voice capture. Long lists virtualize. Metrics poll at 1.6s — no per-frame layout reads.
              </div>
            </Sec>
          )}

          {section === 'advanced' && (
            <Sec title="Advanced" desc="Local bridge — real laptop control (Mark-LIV style skills)">
              <Field label="Bridge token" hint="Same value as ULTRON_TOKEN when you started the bridge">
                <input
                  className="input mono" style={{ maxWidth: 260 }}
                  value={settings.bridgeToken}
                  placeholder="paste ULTRON_TOKEN…"
                  onChange={(e) => { set('bridgeToken', e.target.value); setBridgeToken(e.target.value) }}
                />
              </Field>
              <Field label="Bridge status" hint="node bridge/ultron-bridge.mjs → localhost:8765">
                <Button size="sm" icon="radar" onClick={() => void checkLocalBridge()}>{localBridge === null ? 'Check' : 'Re-check'}</Button>
              </Field>
              {localBridge && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 10, background: 'rgba(148,184,255,0.04)', border: '1px solid var(--line)' }}>
                  <div className="t-sm" style={{ color: localBridge.ok ? 'var(--ok)' : 'var(--err)' }}>
                    • Bridge: {localBridge.ok ? `connected (${localBridge.platform})` : `not reachable — ${localBridge.error ?? 'start it with node bridge/ultron-bridge.mjs'}`}
                  </div>
                  {localBridge.ok && (
                    <>
                      <div className="t-sm" style={{ color: localBridge.commandsEnabled ? 'var(--ok)' : 'var(--warn)' }}>• Command exec: {localBridge.commandsEnabled ? 'enabled' : 'disabled (start bridge with ULTRON_TOKEN)'}</div>
                      <div className="t-sm" style={{ color: localBridge.youtubeConfigured ? 'var(--ok)' : 'var(--warn)' }}>• YouTube uploads: {localBridge.youtubeConfigured ? 'configured' : 'needs GOOGLE_CLIENT_ID/SECRET'}</div>
                    </>
                  )}
                  {skillsView && (
                    <div style={{ marginTop: 4 }}>
                      <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 4 }}>Skills right now</div>
                      <div className="t-xs t-low" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{skillsView}</div>
                    </div>
                  )}
                </div>
              )}
              <ToggleRow title="Holographic avatar" sub="Face with lip-sync on Home (off = abstract core)" icon="user" on={settings.avatarMode} onChange={(v) => set('avatarMode', v)} />
              <div className="badge badge--muted">Instagram/TikTok posting needs each platform's own API approval — YouTube works today. Nothing is faked.</div>
            </Sec>
          )}

          {section === 'data' && (
            <Sec title="Local data" desc="Storage and reset">
              <Field label="Settings storage" hint="localStorage key">
                <code className="mono t-sm" style={{ color: 'var(--cyan)' }}>ultron.settings.v1</code>
              </Field>
              <Field label="Build" hint="Version channel">
                <div className="badge badge--blue">U.L.T.R.0.N. v1.0.0 · AL13N INDUSTRIES</div>
              </Field>
              <Field label="Operator" hint="Built by">
                <a href="https://github.com/al13n-x-v0x" target="_blank" rel="noreferrer" className="mono t-sm" style={{ color: 'var(--cyan)' }}>github.com/al13n-x-v0x</a>
              </Field>
              <Button icon="trash" variant="danger" onClick={() => {
                askConfirm({
                  title: 'Erase all local data?',
                  message: 'Settings, memories, files and staged context will be wiped from this browser.',
                  confirmLabel: 'Erase',
                  danger: true,
                  onConfirm: () => {
                    try { localStorage.clear() } catch { /* ignore */ }
                    pushToast({ title: 'Local data erased', body: 'Reload to start fresh.', kind: 'success' })
                  },
                })
              }}>Erase local data</Button>
            </Sec>
          )}
        </div>
      </div>
    </Modal>
  )
}

const ACCENTS: Record<string, string> = {
  cyan: 'linear-gradient(135deg,#22d3ee,#4f8cff)',
  blue: 'linear-gradient(135deg,#4f8cff,#7c3aed)',
  violet: 'linear-gradient(135deg,#a78bfa,#ec4899)',
  emerald: 'linear-gradient(135deg,#34d399,#22d3ee)',
}

function Sec({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="anim-fade-up" key={title}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
        <div className="t-sm t-low" style={{ marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {hint && <div className="t-xs t-low" style={{ marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center' }}>{children}</div>
    </div>
  )
}

export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Ctrl+K', label: 'Command palette' },
  { keys: 'Ctrl+M', label: 'Microphone (voice input)' },
  { keys: 'Ctrl+/', label: 'Keyboard shortcuts' },
  { keys: 'Ctrl+,', label: 'Settings' },
  { keys: 'Ctrl+⇧+N', label: 'Notifications' },
  { keys: 'Ctrl+⇧+O', label: 'New AI thread' },
  { keys: 'Enter', label: 'Send message' },
  { keys: 'Shift+Enter', label: 'New line in composer' },
  { keys: 'Esc', label: 'Close popups / palette' },
]
