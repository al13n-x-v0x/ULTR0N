import { useEffect, useRef, useMemo } from 'react'
import { useAi } from '../store/aiStore'
import { useData } from '../store/dataStore'
import { useUi } from '../store/uiStore'
import { useMemory } from '../store/memoryStore'
import { AiCore } from '../components/AiCore'
import { Avatar, type AvatarHandle } from '../components/Avatar'
import { CommandBar } from '../components/CommandBar'
import { Ring } from '../components/ui/Meter'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { useSettings } from '../store/settingsStore'

const QUICK: { icon: IconName; label: string; view: string; hint: string }[] = [
  { icon: 'chat', label: 'Chat', view: 'chat', hint: 'Open the conversation console' },
  { icon: 'code', label: 'Code', view: 'code', hint: 'Editor + live preview' },
  { icon: 'spark', label: 'Create', view: 'chat', hint: 'Creative mode session' },
  { icon: 'activity', label: 'Analyze', view: 'tools', hint: 'System telemetry' },
  { icon: 'globe', label: 'Research', view: 'research', hint: 'Web knowledge lane' },
]

const MODE_CHIPS: { id: string; label: string; icon: IconName }[] = [
  { id: 'research', label: 'Deep Research', icon: 'globe' },
  { id: 'plan', label: 'Plan', icon: 'target' },
  { id: 'create', label: 'Brainstorm', icon: 'spark' },
  { id: 'code', label: 'Code', icon: 'code' },
  { id: 'reason', label: 'Analyze', icon: 'activity' },
]

export function HomeView() {
  const mode = useAi((s) => s.mode)
  const setMode = useAi((s) => s.setMode)
  const setView = useUi((s) => s.setView)
  const metrics = useData((s) => s.metrics)
  const memories = useMemory((s) => s.memories.length)
  const name = useSettings((s) => s.settings.displayName)
  const aiState = useAi((s) => s.state)
  const avatarMode = useSettings((s) => s.settings.avatarMode)
  const motion = useSettings((s) => s.settings.motion)
  const messages = useAi((s) => s.messages)
  // The avatar narrates: every fresh completed reply is lip-synced by the
  // hologram (visemes from the text itself) — it genuinely talks now.
  const avatarRef = useRef<AvatarHandle | null>(null)
  const lastSpokenId = useRef<string | null>(null)
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant' || last.kind === 'pending') return
    if (lastSpokenId.current === last.id) return
    lastSpokenId.current = last.id
    if (!avatarMode || !motion) return
    const totalMs = Math.min(9000, 1200 + last.text.length * 38)
    avatarRef.current?.speak(last.text, totalMs)
    const stop = window.setTimeout(() => avatarRef.current?.hush(), totalMs + 400)
    return () => window.clearTimeout(stop)
  }, [messages, avatarMode, motion])
  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const dateLine = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
    [],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 340, position: 'relative' }}>
        {/* Greeting block */}
        <div style={{ position: 'absolute', left: 'max(24px, 6%)', top: '38%', transform: 'translateY(-50%)', maxWidth: 330 }}>
          <div className="t-cap" style={{ color: 'var(--text-low)' }}>{dateLine}</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, letterSpacing: '0.02em', margin: '8px 0 2px' }}>
            {greeting}, <span style={{ color: 'var(--cyan)', textShadow: 'var(--glow-text)' }}>{name}</span>
          </h1>
          <p className="t-mid" style={{ fontSize: 15, marginTop: 4 }}>What shall we create today?</p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            {QUICK.map((q) => (
              <button
                key={q.label}
                className="chip"
                title={q.hint}
                onClick={() => setView(q.view)}
                style={{ height: 33, padding: '0 14px', fontSize: 12.5 }}
              >
                <Icon name={q.icon} width={14} />
                {q.label}
              </button>
            ))}
            <button
              className="chip"
              title="The ULX command grammar — model, memory, network, navigation"
              onClick={() => { useAi.getState().setInput('/urx help'); setView('chat') }}
              style={{ height: 33, padding: '0 14px', fontSize: 12.5, borderColor: 'rgba(34,211,238,0.4)' }}
            >
              <Icon name="zap" width={14} />
              ULX
            </button>
          </div>
        </div>

        {/* Core — holographic avatar or abstract core */}
        {avatarMode ? <Avatar size={330} state={aiState} reduced={!motion} onReady={(h) => { avatarRef.current = h }} /> : <AiCore size={330} />}
      </div>

      <div style={{ paddingBottom: 10 }}>
        <CommandBar />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {MODE_CHIPS.map((m) => (
            <button key={m.id} className="chip" data-active={mode === m.id} onClick={() => setMode(m.id as never)}>
              <Icon name={m.icon} width={12} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 12,
        padding: '14px 24px 20px', alignItems: 'stretch',
      }}>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px' }}>
          {[['CPU', metrics.cpu], ['RAM', metrics.ram], ['GPU', metrics.gpu], ['Disk', metrics.disk]].map(([label, v]) => (
            <Ring key={label as string} value={v as number} size={56} stroke={4.5} sub={label as string} />
          ))}
        </div>

        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px' }}>
          <span className="row__icon" style={{ width: 40, height: 40 }}>
            <Icon name="mode" width={18} />
          </span>
          <div style={{ flex: 1 }}>
            <div className="t-cap" style={{ color: 'var(--text-faint)' }}>Active Mode</div>
            <div style={{ fontWeight: 600, fontSize: 15, textTransform: 'capitalize', color: 'var(--cyan)' }}>{mode}</div>
          </div>
          <button className="btn btn--sm" onClick={() => setMode('auto')}>Reset to Auto</button>
        </div>

        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px' }}>
          <span className="row__icon" style={{ width: 40, height: 40 }}>
            <Icon name="brain" width={18} />
          </span>
          <div style={{ flex: 1 }}>
            <div className="t-cap" style={{ color: 'var(--text-faint)' }}>Memory Hub</div>
            <div className="t-sm t-mid">{memories} long-term memories held</div>
          </div>
          <button className="btn btn--sm" onClick={() => setView('memory')}>View</button>
        </div>
      </div>
    </div>
  )
}
