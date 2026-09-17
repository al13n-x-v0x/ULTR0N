/**
 * Minimal, dependency-free markdown renderer for chat replies.
 * Handles: fenced code blocks (with copy button), inline code, **bold**, _italic_,
 * bullet lists. Everything else renders as plain text. No dangerouslySetInnerHTML.
 */
import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'

type Block =
  | { type: 'code'; lang: string; lines: string[] }
  | { type: 'text'; lines: string[] }

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = []
  const lines = src.split('\n')
  let cur: Block | null = null
  let inCode = false
  for (const line of lines) {
    const fence = line.trimStart().match(/^```(\w*)/)
    if (fence) {
      if (inCode && cur?.type === 'code') {
        blocks.push(cur)
        cur = null
        inCode = false
      } else {
        if (cur) blocks.push(cur)
        cur = { type: 'code', lang: fence[1] ?? '', lines: [] }
        inCode = true
      }
      continue
    }
    if (inCode && cur?.type === 'code') {
      cur.lines.push(line)
    } else {
      if (cur?.type !== 'text') {
        if (cur) blocks.push(cur)
        cur = { type: 'text', lines: [] }
      }
      cur.lines.push(line)
    }
  }
  if (cur) blocks.push(cur)
  return blocks
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    }).catch(() => { /* noop */ })
  }
  return (
    <div style={{ margin: '8px 0', borderRadius: 10, border: '1px solid var(--line-strong)', overflow: 'hidden', background: 'rgba(5,9,18,0.85)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderBottom: '1px solid var(--line)' }}>
        <span className="mono t-xs" style={{ color: 'var(--text-faint)' }}>{lang || 'code'}</span>
        <button
          onClick={copy}
          className="btn--icon"
          aria-label="Copy code"
          style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', color: copied ? 'var(--ok)' : 'var(--text-low)' }}
        >
          <Icon name={copied ? 'check' : 'copy'} width={13} />
        </button>
      </div>
      <pre className="mono" style={{ margin: 0, padding: '10px 12px', fontSize: 12, lineHeight: 1.55, overflowX: 'auto', color: '#c9e3ff' }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

/** Inline formatting: `code`, **bold**, _italic_ — as flat React nodes. */
function inline(text: string, keyBase: string) {
  const out: ReactNode[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyBase}-${i++}`
    if (tok.startsWith('`')) {
      out.push(
        <code key={key} className="mono" style={{ background: 'rgba(34,211,238,0.09)', border: '1px solid rgba(34,211,238,0.22)', borderRadius: 5, padding: '1px 5px', fontSize: '0.92em', color: '#9be7f7' }}>
          {tok.slice(1, -1)}
        </code>,
      )
    } else if (tok.startsWith('**')) {
      out.push(<strong key={key} style={{ fontWeight: 650 }}>{tok.slice(2, -2)}</strong>)
    } else {
      out.push(<em key={key} style={{ color: 'var(--text-mid)' }}>{tok.slice(1, -1)}</em>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function TextBlock({ lines, keyBase }: { lines: string[]; keyBase: string }) {
  const nodes: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length === 0) return
    nodes.push(
      <ul key={`${keyBase}-ul-${nodes.length}`} style={{ margin: '4px 0 4px 4px', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {bullets.map((b, i) => <li key={i}>{inline(b, `${keyBase}-li-${i}`)}</li>)}
      </ul>,
    )
    bullets = []
  }
  lines.forEach((line, i) => {
    const bullet = line.trim().match(/^[•\-*]\s+(.*)$/)
    if (bullet) {
      bullets.push(bullet[1])
      return
    }
    flush()
    if (line.trim().length === 0) {
      nodes.push(<div key={`${keyBase}-sp-${i}`} style={{ height: 6 }} />)
    } else {
      nodes.push(<div key={`${keyBase}-l-${i}`}>{inline(line, `${keyBase}-l-${i}`)}</div>)
    }
  })
  flush()
  return <>{nodes}</>
}

export function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text)
  return (
    <>
      {blocks.map((b, i) =>
        b.type === 'code'
          ? <CodeBlock key={i} lang={b.lang} code={b.lines.join('\n')} />
          : <TextBlock key={i} lines={b.lines} keyBase={`b${i}`} />,
      )}
    </>
  )
}
