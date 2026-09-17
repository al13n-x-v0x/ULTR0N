import { useEffect, useRef, useState } from 'react'
import { useAi } from '../store/aiStore'
import { useSettings } from '../store/settingsStore'
import { CommandBar } from '../components/CommandBar'
import { Icon } from '../components/Icon'
import { IconButton } from '../components/ui/Button'
import { EmptyState } from '../components/ui/StatusDot'
import { speak } from '../lib/speech'
import { Markdown } from '../components/Markdown'
import type { ChatMessage } from '../types'

export function ChatView() {
  const messages = useAi((s) => s.messages)
  const streaming = useAi((s) => s.streaming)
  const voiceReply = useSettings((s) => s.settings.voiceReply)
  const speechRate = useSettings((s) => s.settings.speechRate)
  const autoMem = useSettings((s) => s.settings.autoMemorize)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  // Track last message id to detect new assistant messages
  const lastMsg = messages[messages.length - 1]
  const lastIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.id === 'banner') return
    if (lastIdRef.current === lastMsg.id) return
    // speak once complete (streaming done → streaming flag false)
    if (!streaming && voiceReply && lastMsg.text.length > 0) {
      lastIdRef.current = lastMsg.id
      speak(lastMsg.text, speechRate)
    }
  }, [lastMsg, streaming, voiceReply, speechRate])

  useEffect(() => {
    if (streaming || !autoMem) return
    const m = messages[messages.length - 1]
    if (m && m.role === 'user' && m.text.length > 24) {
      // lightweight auto-memory of substantial user prompts
      import('../store/memoryStore').then(({ useMemory }) => {
        const existing = useMemory.getState().memories
        if (!existing.some((x) => x.text === m.text.slice(0, 120))) {
          useMemory.getState().addMemory(m.text.slice(0, 120), 'note')
        }
      })
    }
  }, [streaming, messages, autoMem])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0 8px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.length <= 1 && (
            <EmptyState
              icon="spark"
              title="Ask anything — or run a command"
              sub="Natural language for reasoning tasks, /commands for control, Ctrl+K for the palette."
            />
          )}
          {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
          <div ref={bottomRef} />
        </div>
      </div>
      <div style={{ padding: '10px 20px 16px' }}>
        <CommandBar />
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === 'user'

  const copy = () => {
    navigator.clipboard?.writeText(msg.text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    }).catch(() => { /* noop */ })
  }

  return (
    <div style={{ display: 'flex', gap: 11, flexDirection: isUser ? 'row-reverse' : 'row', animation: 'fadeUp 200ms cubic-bezier(0.16,1,0.3,1) both' }}>
      <span
        style={{
          width: 30, height: 30, borderRadius: isUser ? '10px 10px 3px 10px' : '10px 10px 10px 3px', flex: 'none',
          display: 'grid', placeItems: 'center',
          background: isUser ? 'rgba(148,184,255,0.1)' : 'linear-gradient(135deg, rgba(34,211,238,0.16), rgba(79,140,255,0.1))',
          border: `1px solid ${isUser ? 'var(--line-strong)' : 'rgba(34,211,238,0.35)'}`,
          color: isUser ? 'var(--text-mid)' : 'var(--cyan)',
        }}
      >
        <Icon name={isUser ? 'user' : 'logo'} width={14} />
      </span>
      <div
        style={{
          maxWidth: 'min(86%, 620px)', padding: '10px 14px', borderRadius: 14,
          background: isUser ? 'rgba(148,184,255,0.07)' : 'rgba(10, 16, 28, 0.8)',
          border: `1px solid ${msg.kind === 'error' ? 'rgba(251,113,133,0.4)' : msg.kind === 'info' ? 'rgba(34,211,238,0.25)' : 'var(--line)'}`,
          lineHeight: 1.6, fontSize: 13.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          color: msg.kind === 'error' ? '#ffd4db' : 'var(--text-hi)',
        }}
      >
        {msg.kind === 'pending' && !msg.text ? (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 0' }} aria-label="U.L.T.R.0.N. is composing">
            {[0, 1, 2].map((i) => (
              <span key={i} style={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)',
                animation: `pendingPulse 1.1s ease-in-out ${i * 0.18}s infinite`,
              }} />
            ))}
          </span>
        ) : isUser ? msg.text : <Markdown text={msg.text} />}
        {!isUser && msg.text.length > 0 && (
          <span style={{ display: 'flex', gap: 4, marginTop: 7, opacity: 0.85, alignItems: 'center' }}>
            <IconButton icon={copied ? 'check' : 'file'} title="Copy" size={13} onClick={copy} />
            <IconButton icon="speaker" title="Read aloud" size={13} onClick={() => speak(msg.text)} />
            {msg.model && <span className="mono t-xs" style={{ color: 'var(--text-faint)', marginLeft: 2 }}>{msg.model}</span>}
          </span>
        )}
      </div>
    </div>
  )
}
