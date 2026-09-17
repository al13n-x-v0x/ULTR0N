import { useEffect, useRef, useState } from 'react'
import { useAi } from '../store/aiStore'
import { useUi } from '../store/uiStore'
import { useSettings } from '../store/settingsStore'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/StatusDot'
import { Toggle } from '../components/ui/Toggle'
import {
  recognitionSupported, startContinuousStt, speak, stopSpeaking, speakingNow,
  listVoices, onVoicesReady, type SttSession,
} from '../lib/speech'

type Flow = 'idle' | 'listening' | 'answering'

export function VoiceView() {
  const [supported] = useState(recognitionSupported)
  const [error, setError] = useState<string | null>(null)
  const [partial, setPartial] = useState('')
  const [lastFinal, setLastFinal] = useState('')
  const [answer, setAnswer] = useState('')
  const [flow, setFlow] = useState<Flow>('idle')
  const [convo, setConvo] = useState(false)
  const [level, setLevel] = useState(0)
  const [voices, setVoices] = useState(listVoices())
  const sessionRef = useRef<SttSession | null>(null)
  const st = useSettings((s) => s.settings)
  const set = useSettings((s) => s.set)

  useEffect(() => onVoicesReady(() => setVoices(listVoices())), [])
  useEffect(() => () => { sessionRef.current?.stop(); stopSpeaking() }, [])

  // Mic-reactive bars while listening
  useEffect(() => {
    if (flow !== 'listening') { setLevel(0); return }
    const id = window.setInterval(() => setLevel(0.35 + Math.random() * 0.65), 130)
    return () => window.clearInterval(id)
  }, [flow])

  const handleFinal = (text: string) => {
    setPartial('')
    setLastFinal(text)
    if (!convo) {
      // Dictation mode → put it in the composer
      useAi.getState().setInput(text)
      useUi.getState().pushToast({ title: 'Transcript ready', body: text.slice(0, 80), kind: 'success' })
      return
    }
    // Conversation mode → ask, wait, speak the reply hands-free
    setFlow('answering')
    setAnswer('')
    void (async () => {
      try {
        useAi.getState().setInput(text)
        await useAi.getState().send(text)
        const msgs = useAi.getState().messages
        const last = [...msgs].reverse().find((m) => m.role === 'assistant')
        const reply = last?.text ?? 'I have no reply for that.'
        setAnswer(reply)
        speak(reply, st.speechRate, st.ttsVoice || undefined)
        window.setTimeout(() => { if (convo) setFlow('listening') }, 900)
      } catch (err) {
        setAnswer(err instanceof Error ? err.message : 'Something went wrong.')
        setFlow('listening')
      }
    })()
  }

  const start = () => {
    setError(null)
    setPartial('')
    setFlow('listening')
    const s = startContinuousStt(undefined, {
      onPartial: setPartial,
      onFinal: handleFinal,
      onError: (e) => { setError(e); setFlow('idle') },
    })
    if (!s) { setFlow('idle'); return }
    sessionRef.current = s
    if (!convo) setConvo(true) // continuous session implies conversation flow
  }

  const stop = () => {
    sessionRef.current?.stop()
    sessionRef.current = null
    stopSpeaking()
    setFlow('idle')
    setPartial('')
  }

  const providerLabel =
    st.provider === 'webllm' && st.webllmModel ? st.webllmModel
    : st.provider === 'remote' ? `Remote · ${st.model}`
    : 'Light local core (no model — run Setup for full AI)'

  return (
    <div className="anim-fade-up" style={{ maxWidth: 720, margin: '0 auto', padding: '26px 20px', textAlign: 'center' }}>
      <div className="t-cap" style={{ color: 'var(--text-faint)' }}>Voice Mode</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '6px 0 4px' }}>Talk to U.L.T.R.0.N.</h2>
      <div className="t-xs t-low" style={{ marginBottom: 18 }}>Brain: {providerLabel}</div>

      {/* Orb */}
      <div style={{
        width: 190, height: 190, margin: '0 auto 20px', borderRadius: '50%', position: 'relative',
        display: 'grid', placeItems: 'center',
        background: 'radial-gradient(circle at 40% 35%, rgba(34,211,238,0.18), rgba(6,10,19,0.9) 70%)',
        border: `1px solid ${flow === 'listening' ? 'rgba(34,211,238,0.6)' : flow === 'answering' ? 'rgba(52,211,153,0.5)' : 'var(--line-strong)'}`,
        boxShadow: flow !== 'idle' ? '0 0 44px rgba(34,211,238,0.25)' : 'var(--shadow-1)',
        transition: 'box-shadow 300ms ease, border-color 300ms ease',
      }}>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 44 }}>
          {Array.from({ length: 13 }).map((_, i) => {
            const center = Math.abs(i - 6)
            const h = flow === 'listening'
              ? 8 + (1 - center / 6) * 26 * (0.4 + level * 0.8) * (0.7 + Math.random() * 0.6)
              : flow === 'answering' ? 10 + Math.abs(Math.sin(Date.now() / 300 + i)) * 14 : 6
            return (
              <span key={i} style={{
                width: 3, height: h, borderRadius: 99,
                background: flow === 'listening' ? 'var(--cyan)' : flow === 'answering' ? 'var(--ok)' : 'var(--text-faint)',
                boxShadow: flow !== 'idle' ? '0 0 8px rgba(34,211,238,0.5)' : undefined,
                transition: 'height 120ms ease, background 200ms ease',
              }} />
            )
          })}
        </div>
        {flow !== 'idle' && (
          <span className={`badge ${flow === 'listening' ? 'badge--info' : 'badge--ok'}`} style={{ position: 'absolute', bottom: -12 }}>
            {flow === 'listening' ? 'LISTENING' : 'THINKING'}
          </span>
        )}
      </div>

      {!supported && (
        <div className="badge badge--warn" style={{ marginBottom: 14 }}>
          Continuous STT needs Chrome/Edge. TTS works everywhere.
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 14, color: 'var(--err)', fontSize: 13 }}>
          <Icon name="alert" width={14} /> {error}
        </div>
      )}

      {/* Transcript + answer */}
      <div style={{ minHeight: 84, marginBottom: 16 }}>
        {partial && <p className="t-mid" style={{ fontSize: 14, fontStyle: 'italic', opacity: 0.7 }}>“{partial}…”</p>}
        {lastFinal && <p className="t-sm" style={{ color: 'var(--text-low)', marginTop: 4 }}>You: “{lastFinal}”</p>}
        {answer && (
          <p className="t-sm" style={{ color: 'var(--text-hi)', marginTop: 8, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            <span className="t-cyan" style={{ fontWeight: 600 }}>U.L.T.R.0.N.:</span> {answer.slice(0, 600)}{answer.length > 600 ? '…' : ''}
          </p>
        )}
        {!partial && !lastFinal && !answer && (
          <p className="t-low t-sm">Start the session and just talk. In conversation mode every answer is spoken aloud and the mic re-arms automatically.</p>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {flow === 'idle'
          ? <Button variant="primary" icon="mic" onClick={start} disabled={!supported}>Start talking</Button>
          : <Button variant="danger" icon="stop" onClick={stop}>End session</Button>}
        <Button icon={speakingNow() ? 'volumeX' : 'speaker'} onClick={() => (speakingNow() ? stopSpeaking() : answer && speak(answer, st.speechRate, st.ttsVoice || undefined))}>
          {speakingNow() ? 'Silence' : 'Replay answer'}
        </Button>
      </div>

      {/* Conversation toggle + voice picker */}
      <div className="panel" style={{ marginTop: 24, padding: 6, textAlign: 'left' }}>
        <div className="row" style={{ padding: '9px 11px' }}>
          <span className="row__icon"><Icon name="chat" /></span>
          <div className="row__main">
            <span className="row__title">Conversation mode</span>
            <span className="row__sub">Final speech is sent to the AI and the reply is spoken — full duplex loop</span>
          </div>
          <Toggle on={convo} onChange={setConvo} label="Conversation mode" />
        </div>
        <div className="row" style={{ padding: '9px 11px' }}>
          <span className="row__icon"><Icon name="speaker" /></span>
          <div className="row__main">
            <span className="row__title">Voice</span>
            <span className="row__sub">{voices.length} installed — best-quality (Natural/Google) voices are auto-selected</span>
          </div>
          <select
            className="input"
            style={{ width: 190, height: 30, fontSize: 12 }}
            value={st.ttsVoice}
            onChange={(e) => set('ttsVoice', e.target.value)}
            aria-label="TTS voice"
          >
            <option value="">Auto (best quality)</option>
            {voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        </div>
        <div className="row" style={{ padding: '9px 11px' }}>
          <span className="row__icon"><Icon name="clock" /></span>
          <div className="row__main">
            <span className="row__title">Speaking rate · {st.speechRate.toFixed(1)}×</span>
          </div>
          <input type="range" min={0.6} max={1.6} step={0.1} value={st.speechRate} onChange={(e) => set('speechRate', Number(e.target.value))} style={{ width: 140, accentColor: '#22d3ee' }} aria-label="Speech rate" />
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <EmptyState
          icon="shield"
          title="Permission-gated & private"
          sub="The microphone is requested only while the session is running. Recognition runs in the browser; with an on-device model, your voice never leaves this machine."
        />
      </div>
    </div>
  )
}
