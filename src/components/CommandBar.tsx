import { useRef, useState, type KeyboardEvent } from 'react'
import { useAi } from '../store/aiStore'
import { useUi } from '../store/uiStore'
import { useSettings } from '../store/settingsStore'
import { Icon } from './Icon'
import { IconButton } from './ui/Button'
import { Tooltip } from './ui/Tooltip'
import { startRecognition, stopSpeaking } from '../lib/speech'
import type { Mode } from '../types'

export function CommandBar() {
  const input = useAi((s) => s.input)
  const setInput = useAi((s) => s.setInput)
  const send = useAi((s) => s.send)
  const stop = useAi((s) => s.stop)
  const streaming = useAi((s) => s.streaming)
  const aiState = useAi((s) => s.state)
  const mode = useAi((s) => s.mode)
  const attachments = useAi((s) => s.attachments)
  const attach = useAi((s) => s.attach)
  const detach = useAi((s) => s.detach)
  const voiceReply = useSettings((s) => s.settings.voiceReply)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const recRef = useRef<{ stop: () => void } | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [listening, setListening] = useState(false)
  const [modesOpen, setModesOpen] = useState(false)

  const busy = streaming

  const doSend = () => {
    if (!input.trim() || busy) return
    void send(input)
    if (voiceReply) {
      // Voice reply handled after response in ChatView; here just stop any ongoing speech
      stopSpeaking()
    }
    taRef.current?.focus()
  }

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      useAi.setState({ state: 'idle' })
      return
    }
    setListening(true)
    useAi.setState({ state: 'listening' })
    recRef.current = startRecognition(
      (transcript, isFinal) => {
        if (isFinal) {
          setInput(transcript.trim())
          setListening(false)
          useAi.setState({ state: 'idle' })
          taRef.current?.focus()
        } else {
          setInput(transcript)
        }
      },
      (err) => {
        setListening(false)
        useAi.setState({ state: err ? 'error' : 'idle' })
        if (err) useUi.getState().pushToast({ title: 'Voice input', body: err, kind: 'error' })
        window.setTimeout(() => { if (useAi.getState().state === 'error') useAi.setState({ state: 'idle' }) }, 1600)
      },
    )
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      doSend()
    }
  }

  const onFiles = (fl: FileList | null) => {
    if (!fl) return
    Array.from(fl).slice(0, 4).forEach((f) => {
      const isText = f.type.startsWith('text/') || /\.(txt|md|json|ts|tsx|js|jsx|css|html|py|rs|go|java|c|cpp|h|sh|ya?ml|toml|csv)$/i.test(f.name)
      if (isText && f.size < 400_000) {
        const reader = new FileReader()
        reader.onload = () => {
          attach({ id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${f.name}`, name: f.name, kind: f.type || 'file', size: f.size, text: String(reader.result ?? '').slice(0, 60_000) })
        }
        reader.onerror = () => {
          attach({ id: `att_${Date.now()}_${f.name}`, name: f.name, kind: f.type || 'file', size: f.size })
        }
        reader.readAsText(f)
      } else {
        attach({ id: `att_${Date.now()}_${f.name}`, name: f.name, kind: f.type || 'file', size: f.size })
      }
    })
  }

  const lines = Math.min(6, input.split('\n').length)
  const height = Math.max(46, 20 + lines * 21)

  return (
    <div style={{ width: '100%', maxWidth: 780, margin: '0 auto', position: 'relative' }}>
      {/* Attachments row */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, animation: 'fadeUp 180ms cubic-bezier(0.16,1,0.3,1) both' }}>
          {attachments.map((a) => (
            <span key={a.id} className="chip" data-active="true">
              <Icon name="paperclip" width={12} />
              {a.name}
              <button onClick={() => detach(a.id)} aria-label={`Remove ${a.name}`} style={{ display: 'grid', placeItems: 'center', marginLeft: 2 }}>
                <Icon name="close" width={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          padding: '8px 10px 8px 16px',
          background: 'rgba(9, 14, 26, 0.82)',
          border: `1px solid ${listening || busy ? 'rgba(34,211,238,0.5)' : 'var(--line-strong)'}`,
          borderRadius: 18,
          boxShadow: listening || busy ? '0 0 24px rgba(34,211,238,0.12), var(--shadow-2)' : 'var(--shadow-2)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          transition: 'border-color 200ms ease, box-shadow 200ms ease',
        }}
      >
        <button
          onClick={() => setModesOpen((o) => !o)}
          className="chip"
          data-active={modesOpen}
          style={{ height: 30, marginBottom: 3, flex: 'none' }}
          aria-expanded={modesOpen}
        >
          <Icon name="mode" width={13} />
          <span className="t-cap" style={{ fontSize: 10 }}>{mode}</span>
          <Icon name="chevD" width={11} />
        </button>

        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder="Ask U.L.T.R.0.N. anything..."
          aria-label="Ask U.L.T.R.0.N. anything"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none',
            color: 'var(--text-hi)', fontSize: 14, lineHeight: '21px', height,
            padding: '12px 0 10px', fontFamily: 'var(--font-ui)',
          }}
        />

        <div style={{ display: 'flex', gap: 2, alignItems: 'center', paddingBottom: 2 }}>
          <Tooltip label={listening ? 'Stop listening' : 'Voice input (Ctrl+M)'} side="top">
            <IconButton icon="mic" title={listening ? 'Stop listening' : 'Voice input'} active={listening} onClick={toggleMic} />
          </Tooltip>
          <Tooltip label="Attach file" side="top">
            <IconButton icon="paperclip" title="Attach file" onClick={() => fileRef.current?.click()} />
          </Tooltip>
          <Tooltip label="Vision / camera" side="top">
            <IconButton
              icon="camera" title="Vision / camera"
              onClick={() => { useUi.getState().setView('vision'); useUi.getState().setRightTab('camera') }}
            />
          </Tooltip>
          {busy ? (
            <Tooltip label="Stop generating" side="top">
              <button className="btn btn--danger btn--sm" style={{ height: 34, width: 38, padding: 0, display: 'grid', placeItems: 'center' }} onClick={stop} aria-label="Stop generating">
                <Icon name="stop" width={14} />
              </button>
            </Tooltip>
          ) : (
            <Tooltip label="Send (Enter)" side="top">
              <button
                className="btn btn--primary"
                style={{ height: 34, width: 38, padding: 0, display: 'grid', placeItems: 'center' }}
                onClick={doSend}
                disabled={!input.trim()}
                aria-label="Send message"
              >
                <Icon name="send" width={15} />
              </button>
            </Tooltip>
          )}
        </div>

        <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />
      </div>

      {/* Mode selector popup */}
      {modesOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setModesOpen(false)} />
          <div
            className="anim-pop"
            style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: 8, zIndex: 61,
              background: 'rgba(11, 17, 30, 0.97)', border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-l)', boxShadow: 'var(--shadow-pop)', padding: 6,
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, width: 380,
            }}
            role="menu"
          >
            {(['auto', 'reason', 'research', 'vision', 'code', 'create', 'plan', 'focus', 'study', 'developer'] as Mode[]).map((m) => (
              <button
                key={m}
                className="row row--btn"
                role="menuitem"
                style={{ padding: '8px 10px', borderRadius: 10 }}
                data-active={m === mode}
                onClick={() => { useAi.getState().setMode(m); setModesOpen(false) }}
              >
                <span className="row__title" style={{ fontSize: 12.5, textTransform: 'capitalize' }}>{m}</span>
                {m === mode && <Icon name="check" width={13} style={{ color: 'var(--cyan)' }} />}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 9 }}>
        <span className="t-xs t-faint" style={{ color: 'var(--text-faint)' }}>
          <span className="kbd">Enter</span> send · <span className="kbd">Shift+Enter</span> newline · <span className="kbd">Ctrl+K</span> palette
        </span>
        <span className="t-xs" style={{ color: 'var(--text-faint)' }}>{aiState !== 'idle' ? aiState.toUpperCase() : ''}</span>
      </div>
    </div>
  )
}
