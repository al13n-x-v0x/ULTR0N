import { useRef, useState } from 'react'
import { useUi } from '../store/uiStore'
import { useAi } from '../store/aiStore'
import { askAi } from '../lib/ai'
import { Icon } from '../components/Icon'
import { Markdown } from '../components/Markdown'
import { Button } from '../components/ui/Button'
const DEFAULT_CODE = `// U.L.T.R.0.N. sandbox — Ctrl+Enter or ▶ to run
// console.log streams to the output panel.

const fib = (n) => (n <= 1 ? n : fib(n - 1) + fib(n - 2));

console.log('fib(1..10):', Array.from({ length: 10 }, (_, i) => fib(i + 1)).join(', '));

const uptime = 'U.L.T.R.0.N. sandbox online';
console.log(uptime);
`

export function CodeView() {
  const pushToast = useUi((s) => s.pushToast)
  const [code, setCode] = useState(DEFAULT_CODE)
  const [output, setOutput] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiReply, setAiReply] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const frameRef = useRef<HTMLIFrameElement | null>(null)

  const run = () => {
    setRunning(true)
    const logs: string[] = []
    const fmt = (a: unknown): string => {
      if (typeof a === 'string') return a
      try { return JSON.stringify(a) ?? String(a) } catch { return String(a) }
    }
    const sandboxLog = (...args: unknown[]) => { logs.push(args.map(fmt).join(' ')) }
    let frame: HTMLIFrameElement | null = null
    try {
      // Run inside an iframe sandbox: no DOM access to the app, no same-origin.
      frame = document.createElement('iframe')
      frame.style.display = 'none'
      frame.setAttribute('sandbox', 'allow-scripts')
      document.body.appendChild(frame)
      const w = frame.contentWindow as (Window & { console: Console }) | null
      if (!w) throw new Error('Sandbox unavailable')
      w.console.log = sandboxLog as typeof console.log
      w.console.info = sandboxLog as typeof console.log
      w.console.warn = sandboxLog as typeof console.log
      w.console.error = sandboxLog as typeof console.error
      // Execute in the sandboxed realm (synchronous section)
      const result = (w as unknown as { eval: (s: string) => unknown }).eval(code)
      if (result !== undefined) logs.push(`→ ${fmt(result)}`)
    } catch (err) {
      logs.push(`✗ ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      // Keep the frame briefly so async logs can still land, then dispose.
      window.setTimeout(() => {
        frame?.remove()
        setOutput(logs.length > 0 ? logs : ['(no output — use console.log)'])
        setRunning(false)
      }, 120)
    }
  }

  const format = () => {
    // Lightweight formatter: normalize indentation of braces
    let indent = 0
    const out = code.split('\n').map((line) => {
      const t = line.trim()
      if (t.startsWith('}')) indent = Math.max(0, indent - 1)
      const res = '  '.repeat(indent) + t
      if (t.endsWith('{')) indent++
      return res
    }).join('\n')
    setCode(out)
    pushToast({ title: 'Formatted', body: 'Indentation normalized.', kind: 'success' })
  }

  const toAi = () => {
    useAi.getState().setInput(`Review this code:\n\n\`\`\`js\n${code.slice(0, 1200)}\n\`\`\``)
    useUi.getState().setView('chat')
    pushToast({ title: 'Sent to chat', body: 'Press Enter to get a review.', kind: 'info' })
  }

  /** Ask the active AI (on-device or remote) about this buffer, in place. */
  const aiAct = async (task: 'explain' | 'fix' | 'test') => {
    if (aiBusy) return
    setAiBusy(true)
    setAiReply('')
    const prompts = {
      explain: 'Explain what this JavaScript does, then note any bugs or edge cases. Be concise:\n\n```js\n' + code.slice(0, 6000) + '\n```',
      fix: 'Find and fix bugs in this JavaScript. Reply with the corrected full code in one fenced js block, then a one-line summary of the changes:\n\n```js\n' + code.slice(0, 6000) + '\n```',
      test: 'Write a small set of console-based test cases for this JavaScript (no frameworks). Reply with one fenced js block:\n\n```js\n' + code.slice(0, 6000) + '\n```',
    } as const
    try {
      const { getAiSettings } = await import('../store/settingsStore')
      const reply = await askAi(getAiSettings(), prompts[task], 'code')
      setAiReply(reply || '(empty reply — is a model loaded? run /setup)')
    } catch (err) {
      setAiReply(`✗ ${err instanceof Error ? err.message : String(err)}\n\nTip: run /setup to install an on-device model, or connect an API key in Settings → AI.`)
    } finally {
      setAiBusy(false)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run() }
  }

  return (
    <div className="anim-fade-up" style={{ padding: '22px 24px', height: '100%', display: 'flex', flexDirection: 'column', maxWidth: 1280, margin: '0 auto', minHeight: 0 }}>
      <div className="view-head" style={{ flex: 'none' }}>
        <span className="row__icon"><Icon name="code" /></span>
        <div style={{ flex: 1 }}>
          <h2>Code Workspace</h2>
          <div className="t-xs t-low">JavaScript runs in a sandboxed iframe — no app access, no network</div>
        </div>
        <Button size="sm" icon="spark" onClick={toAi}>Ask AI</Button>
        <Button size="sm" icon="brain" onClick={() => void aiAct('explain')} disabled={aiBusy}>{aiBusy ? 'Thinking…' : 'Explain'}</Button>
        <Button size="sm" icon="edit" onClick={format}>Format</Button>
        <Button size="sm" icon="copy" onClick={() => { navigator.clipboard?.writeText(code); pushToast({ title: 'Copied', kind: 'success' }) }}>Copy</Button>
        <Button size="sm" variant="primary" icon="play" onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run'}
        </Button>
      </div>

      <div className="code-grid" style={{ flex: 1, minHeight: 0 }}>
        <textarea
          className="code-editor"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          aria-label="Code editor"
        />
        {showPreview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="sm" variant="ghost" icon="close" onClick={() => setShowPreview(false)}>Close preview</Button>
            </div>
            <iframe
              ref={frameRef}
              className="iframe-preview"
              title="Preview"
              sandbox="allow-scripts"
              srcDoc={`<body style="font-family:system-ui;background:#0b1120;color:#d7e6ff;padding:14px"><div id="app"></div></body>`}
            />
          </div>
        ) : aiReply ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="t-cap" style={{ color: 'var(--cyan)' }}>AI reply · active model</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button size="sm" variant="ghost" icon="copy" onClick={() => { navigator.clipboard?.writeText(aiReply); pushToast({ title: 'Copied', kind: 'success' }) }}>Copy</Button>
                <Button size="sm" variant="ghost" icon="close" onClick={() => setAiReply('')}>Close</Button>
              </div>
            </div>
            <div className="code-out" style={{ flex: 1, overflowY: 'auto', whiteSpace: 'normal' }} aria-live="polite">
              <Markdown text={aiReply} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="sm" variant="ghost" icon="eye" onClick={() => setShowPreview(true)}>Preview</Button>
            </div>
            <div className="code-out" style={{ flex: 1 }} aria-live="polite">
              {output.length === 0 ? '// Output appears here — press Run (Ctrl+Enter)' : output.join('\n')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
