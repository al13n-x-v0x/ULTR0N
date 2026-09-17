/**
 * Clipboard Intelligence — the Mark-LIV feature: select any text anywhere,
 * copy it, press Ctrl+Shift+V → a floating panel offers Explain / Summarise /
 * Fix / Translate, answered by the active model (on-device or remote).
 */
import { useState } from 'react'
import { useUi } from '../store/uiStore'
import { useSettings } from '../store/settingsStore'
import { askAi } from '../lib/ai'
import { speak } from '../lib/speech'
import { Markdown } from './Markdown'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Icon } from './Icon'

type Task = 'explain' | 'summarise' | 'fix' | 'translate'

const TASKS: { id: Task; label: string; icon: string; hint: string }[] = [
  { id: 'explain', label: 'Explain', icon: 'info', hint: 'What does this text mean?' },
  { id: 'summarise', label: 'Summarise', icon: 'list', hint: 'Key points only' },
  { id: 'fix', label: 'Fix', icon: 'edit', hint: 'Correct grammar, spelling or code errors' },
  { id: 'translate', label: 'Translate', icon: 'globe', hint: 'Translate to English (or reply in English)' },
]

function buildPrompt(task: Task, text: string): string {
  const clipped = text.slice(0, 6000)
  switch (task) {
    case 'explain':
      return `Explain this clearly and concisely:\n\n${clipped}`
    case 'summarise':
      return `Summarise this into key bullet points:\n\n${clipped}`
    case 'fix':
      return `Fix any grammar, spelling or code errors in this. Reply with the corrected text first, then a one-line note of what changed:\n\n${clipped}`
    case 'translate':
      return `Detect the language of this text and translate it to English. If it is already English, translate to French:\n\n${clipped}`
  }
}

export function ClipboardModal() {
  const open = useUi((s) => s.clipboardOpen)
  const setOpen = useUi((s) => s.setClipboardOpen)
  const pushToast = useUi((s) => s.pushToast)
  const [text, setText] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastTask, setLastTask] = useState<Task | null>(null)

  const run = async (task: Task) => {
    if (!text.trim() || busy) return
    setBusy(true)
    setLastTask(task)
    setReply('')
    try {
      const settings = useSettings.getState().settings
      const out = await askAi(settings, buildPrompt(task, text), task === 'fix' ? 'code' : 'auto')
      setReply(out || '(empty reply — is a model loaded? run /setup)')
    } catch (err) {
      setReply(`✗ ${err instanceof Error ? err.message : String(err)}\n\nTip: run /setup for an on-device model, or add an API key in Settings → AI.`)
    } finally {
      setBusy(false)
    }
  }

  const pasteIn = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t.trim()) {
        setText(t)
        setReply('')
        pushToast({ title: 'Clipboard captured', body: `${t.length} characters`, kind: 'success' })
      } else {
        pushToast({ title: 'Clipboard is empty', kind: 'info' })
      }
    } catch {
      pushToast({ title: 'Paste manually', body: 'Browser blocked clipboard read — paste into the box (Ctrl+V).', kind: 'info' })
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Clipboard Intelligence"
      subtitle="Any text you copied — explained, summarised, fixed or translated"
      icon="file"
      width={680}
      footer={
        <>
          <Button variant="ghost" icon="copy" onClick={() => { if (reply) { navigator.clipboard?.writeText(reply); pushToast({ title: 'Reply copied', kind: 'success' }) } }} disabled={!reply}>Copy reply</Button>
          <Button variant="primary" icon="check" onClick={() => setOpen(false)}>Done</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" icon="link" onClick={() => void pasteIn()}>Read clipboard</Button>
          <span className="t-xs t-low" style={{ alignSelf: 'center' }}>…or paste/type below (Ctrl+Shift+V anywhere opens this)</span>
        </div>
        <textarea
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type the text to work with…"
          rows={4}
          style={{ resize: 'vertical', minHeight: 80, fontFamily: 'var(--font-ui)' }}
          aria-label="Clipboard text"
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TASKS.map((t) => (
            <Button key={t.id} size="sm" icon={t.icon} onClick={() => void run(t.id)} disabled={!text.trim() || busy}>
              {busy && lastTask === t.id ? 'Thinking…' : t.label}
            </Button>
          ))}
          {reply && (
            <Button size="sm" variant="ghost" icon="speaker" onClick={() => speak(reply)}>Read aloud</Button>
          )}
        </div>
        {busy && <div className="progress" style={{ height: 4 }}><div className="progress-bar" /></div>}
        {reply && (
          <div
            className="panel"
            style={{ padding: '12px 14px', maxHeight: 340, overflowY: 'auto', lineHeight: 1.6, fontSize: 13.5 }}
            aria-live="polite"
          >
            <div className="t-cap" style={{ color: 'var(--cyan)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="spark" width={12} />
              {lastTask} · {useSettings.getState().settings.provider === 'webllm' ? 'on-device' : useSettings.getState().settings.provider === 'remote' ? 'remote API' : 'light core'}
            </div>
            <Markdown text={reply} />
          </div>
        )}
      </div>
    </Modal>
  )
}
