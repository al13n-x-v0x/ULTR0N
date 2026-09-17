import { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../store/settingsStore'
import { useAi } from '../store/aiStore'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Icon, type IconName } from './Icon'
import {
  probeHardware, recommendTier, modelsForTier, fitsMachine, loadModel, onModelProgress, detectOllama,
  CATALOG, type HardwareReport, type ModelSpec, type Tier, type LoadProgress,
} from '../lib/localModels'

type Phase = 'probing' | 'choose' | 'downloading' | 'done' | 'failed'

const TIER_META: Record<Tier, { label: string; icon: IconName; note: string }> = {
  low: { label: 'Light laptop', icon: 'cpu', note: 'Sub-1B models — featherweight, instant, near-zero footprint' },
  mid: { label: 'Mid-range laptop', icon: 'monitor', note: '1.5–3B models — the sweet spot of speed vs. intelligence' },
  high: { label: 'Powerful machine', icon: 'spark', note: '7B-class models — deep reasoning, needs RAM + VRAM headroom' },
}

/**
 * First-launch intelligence setup.
 * Probes the real hardware, recommends a model tier that FITS, offers a genuine
 * on-device download (WebLLM/WebGPU), and detects an existing Ollama install.
 */
export function SetupWizard() {
  const settings = useSettings((s) => s.settings)
  const set = useSettings((s) => s.set)
  const [phase, setPhase] = useState<Phase>('probing')
  const [hw, setHw] = useState<HardwareReport | null>(null)
  const [tier, setTier] = useState<Tier>('mid')
  const [reason, setReason] = useState('')
  const [selected, setSelected] = useState<string>('')
  const [prog, setProg] = useState<LoadProgress>({ phase: 'idle', progress: 0, text: '' })
  const [ollama, setOllama] = useState<{ ok: boolean; models: string[] } | null>(null)
  const [err, setErr] = useState('')

  const open = !settings.setupDone

  const runProbe = async () => {
    setPhase('probing')
    setErr('')
    const [report, ol] = await Promise.all([
      probeHardware(),
      detectOllama().catch(() => ({ ok: false, models: [] as string[] })),
    ])
    setHw(report)
    setOllama(ol)
    const rec = recommendTier(report)
    setTier(rec.tier)
    setReason(rec.reason)
    const best = modelsForTier(rec.tier).find((m) => fitsMachine(m, report).ok)
    setSelected(best?.id ?? '')
    setPhase('choose')
  }

  useEffect(() => {
    if (open && phase === 'probing' && !hw) void runProbe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => onModelProgress(setProg), [])

  const download = async () => {
    if (!selected) return
    setPhase('downloading')
    try {
      await loadModel(selected)
      set('webllmModel', selected)
      set('provider', 'webllm')
      set('setupDone', true)
      setPhase('done')
      useAi.getState().newThread()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setPhase('failed')
    }
  }

  const skip = () => {
    set('setupDone', true)
  }

  const models = useMemo(() => (hw ? modelsForTier(tier) : []), [hw, tier])

  return (
    <Modal
      open={open}
      onClose={skip}
      title="U.L.T.R.0.N. — Local Intelligence Setup"
      subtitle="Scanning this laptop to pick an AI model that fits it"
      icon="cpu"
      width={640}
      footer={
        phase === 'choose' ? (
          <>
            <Button variant="ghost" onClick={skip}>Skip for now</Button>
            <Button variant="primary" icon="download" onClick={download} disabled={!selected}>
              {selected ? `Download & activate (${fmtGb(CATALOG.find((m) => m.id === selected)?.sizeGb ?? 0)})` : 'No compatible model'}
            </Button>
          </>
        ) : phase === 'done' ? (
          <Button variant="primary" icon="check" onClick={skip}>Start using U.L.T.R.0.N.</Button>
        ) : phase === 'failed' ? (
          <>
            <Button variant="ghost" onClick={skip}>Use light core</Button>
            <Button icon="refresh" onClick={runProbe}>Retry probe</Button>
          </>
        ) : undefined
      }
    >
      {phase === 'probing' && (
        <div className="empty" style={{ padding: 40 }}>
          <span className="spinner" style={{ width: 26, height: 26 }} />
          <div className="empty-title">Scanning your machine…</div>
          <div className="empty-sub">CPU threads · memory · storage quota · WebGPU capability · local model bridges</div>
        </div>
      )}

      {phase === 'choose' && hw && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Hardware report */}
          <div className="panel" style={{ padding: 14 }}>
            <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 10 }}>Detected hardware</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <Spec label="CPU threads" value={String(hw.threads)} />
              <Spec label="Memory" value={hw.ramGb !== null ? `~${hw.ramGb} GB` : 'hidden by browser'} warn={hw.ramGb === null} />
              <Spec label="Free storage" value={hw.storageFreeGb !== null ? `${hw.storageFreeGb} GB` : 'unknown'} warn={hw.storageFreeGb === null} />
              <Spec label="WebGPU" value={hw.webgpu ? (hw.adapter ?? 'available') : 'not available'} warn={!hw.webgpu} />
            </div>
            {ollama?.ok && (
              <div className="badge badge--ok" style={{ marginTop: 10 }}>
                Ollama bridge detected · {ollama.models.length} model{ollama.models.length === 1 ? '' : 's'} installed — you can use it in Settings → AI
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="panel" style={{ padding: 14, borderColor: 'rgba(34,211,238,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="row__icon"><Icon name={TIER_META[tier].icon} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  Recommended: <span style={{ color: 'var(--cyan)' }}>{TIER_META[tier].label}</span>
                </div>
                <div className="t-xs t-low" style={{ marginTop: 2, lineHeight: 1.5 }}>{reason}</div>
              </div>
            </div>
          </div>

          {/* Model choices */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="t-cap" style={{ color: 'var(--text-faint)' }}>Choose your on-device model — tags: chat · code · reasoning · fast</div>
            {models.map((m) => <ModelOption key={m.id} m={m} hw={hw} selected={selected === m.id} onSelect={() => setSelected(m.id)} />)}
            <div className="t-xs t-low" style={{ marginTop: 2, display: 'flex', gap: 6 }}>
              <Icon name="shield" width={13} />
              Downloaded once, cached by the browser, runs 100% on this machine — no cloud, works offline after install.
            </div>
          </div>
        </div>
      )}

      {phase === 'downloading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="row__icon"><Icon name="download" /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{CATALOG.find((m) => m.id === selected)?.label}</div>
              <div className="t-xs t-low">{prog.text}</div>
            </div>
            <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--cyan)' }}>{Math.round(prog.progress * 100)}%</span>
          </div>
          <div className="progress" style={{ height: 6 }}>
            <div style={{
              height: '100%', borderRadius: 99, width: `${prog.progress * 100}%`,
              background: 'linear-gradient(90deg,#22d3ee,#4f8cff)', boxShadow: '0 0 12px rgba(34,211,238,0.5)',
              transition: 'width 250ms cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
          <div className="t-xs t-low" style={{ lineHeight: 1.6 }}>
            {prog.phase === 'fetching'
              ? 'Downloading weights to the browser cache — keep this tab open. One-time only.'
              : 'Compiling GPU shaders for this machine — usually 10–30 seconds.'}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="empty" style={{ padding: 36 }}>
          <span className="row__icon" style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--ok-soft)', borderColor: 'rgba(52,211,153,0.4)', color: 'var(--ok)' }}>
            <Icon name="check" width={24} />
          </span>
          <div className="empty-title">Local intelligence online</div>
          <div className="empty-sub">
            {CATALOG.find((m) => m.id === selected)?.label} is now running fully on this laptop.
            Talk to it in Chat, use voice with STT + spoken replies, and it works even when you're offline.
          </div>
        </div>
      )}

      {phase === 'failed' && (
        <div className="empty" style={{ padding: 36 }}>
          <span className="row__icon" style={{ background: 'var(--err-soft)', borderColor: 'rgba(251,113,133,0.4)', color: 'var(--err)' }}>
            <Icon name="alert" width={20} />
          </span>
          <div className="empty-title">Model load failed</div>
          <div className="empty-sub">{err}</div>
          <div className="empty-sub">
            Common causes: WebGPU unsupported (use Chrome/Edge), not enough free VRAM for the chosen model, or interrupted download.
            Pick a smaller tier and retry.
          </div>
        </div>
      )}
    </Modal>
  )
}

function Spec({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(148,184,255,0.04)', border: '1px solid var(--line)' }}>
      <div className="t-xs t-low">{label}</div>
      <div className="mono ellipsis" style={{ fontSize: 12, fontWeight: 600, color: warn ? 'var(--warn)' : 'var(--text-hi)', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function ModelOption({ m, hw, selected, onSelect }: { m: ModelSpec; hw: HardwareReport; selected: boolean; onSelect: () => void }) {
  const fit = fitsMachine(m, hw)
  const rec = m.tier === recommendTier(hw).tier
  return (
    <button
      onClick={onSelect}
      disabled={!fit.ok}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 12,
        textAlign: 'left', cursor: fit.ok ? 'pointer' : 'not-allowed',
        background: selected ? 'var(--cyan-soft)' : 'rgba(148,184,255,0.03)',
        border: `1px solid ${selected ? 'rgba(34,211,238,0.5)' : 'var(--line)'}`,
        opacity: fit.ok ? 1 : 0.5,
        transition: 'all 130ms ease',
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: '50%', flex: 'none',
        border: `2px solid ${selected ? 'var(--cyan)' : 'var(--line-strong)'}`,
        background: selected ? 'var(--cyan)' : 'transparent',
        boxShadow: selected ? '0 0 10px rgba(34,211,238,0.6)' : undefined,
      }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
          {rec && <span className="badge badge--info">recommended</span>}
          <span className="badge badge--muted">{m.tier}</span>
          {(m.tags ?? []).map((t) => (
            <span key={t} className="badge badge--blue" style={{ fontSize: 9.5 }}>{t}</span>
          ))}
        </span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-low)', marginTop: 2 }}>{m.blurb}</span>
        <span className="mono" style={{ display: 'block', fontSize: 10.5, color: 'var(--text-faint)', marginTop: 3 }}>
          ~{m.sizeGb}GB download · ~{m.ramGb}GB RAM · ~{m.vramGb}GB VRAM
          {!fit.ok ? ` — ✗ ${fit.why}` : ''}
        </span>
      </span>
      <Icon name={fit.ok ? 'download' : 'alert'} width={15} style={{ color: selected ? 'var(--cyan)' : 'var(--text-faint)', flex: 'none' }} />
    </button>
  )
}

function fmtGb(n: number): string {
  return n < 1 ? `${Math.round(n * 1000)}MB` : `${n.toFixed(1)}GB`
}
