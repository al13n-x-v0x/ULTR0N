import { useMemo, useState } from 'react'
import { useMemory } from '../store/memoryStore'
import { useAi } from '../store/aiStore'
import { useUi } from '../store/uiStore'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/StatusDot'

export function MemoryView() {
  const memories = useMemory((s) => s.memories)
  const addMemory = useMemory((s) => s.addMemory)
  const removeMemory = useMemory((s) => s.removeMemory)
  const clearAll = useMemory((s) => s.clearAll)
  const newThread = useAi((s) => s.newThread)
  const pushToast = useUi((s) => s.pushToast)
  const askConfirm = useUi((s) => s.askConfirm)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? memories.filter((m) => m.text.toLowerCase().includes(q)) : memories
  }, [memories, query])

  const remember = () => {
    const text = draft.trim()
    if (!text) return
    addMemory(text, 'note')
    setDraft('')
    pushToast({ title: 'Memory saved', body: text.slice(0, 60), kind: 'success' })
  }

  return (
    <div className="anim-fade-up" style={{ padding: '22px 24px', maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span className="row__icon"><Icon name="brain" /></span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>Memory Hub</h2>
          <div className="t-xs t-low">Long-term memory · recent context · preferences — all local</div>
        </div>
        <span className="badge badge--info">{memories.length} items</span>
      </div>

      <div className="panel" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Remember that…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') remember() }}
            aria-label="New memory"
          />
          <Button variant="primary" icon="plus" onClick={remember} disabled={!draft.trim()}>Save</Button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <Icon name="search" width={14} style={{ color: 'var(--cyan)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memory…"
            className="input"
            style={{ height: 30, border: 'none', background: 'transparent', padding: 0 }}
            aria-label="Search memory"
          />
          <Button
            size="sm" variant="ghost" icon="trash"
            onClick={() => askConfirm({
              title: 'Clear ALL long-term memory?',
              message: 'Every saved memory will be permanently deleted from this device.',
              confirmLabel: 'Erase memory',
              danger: true,
              onConfirm: () => { clearAll(); pushToast({ title: 'Memory erased', kind: 'success' }) },
            })}
          >
            Clear all
          </Button>
          <Button
            size="sm" variant="ghost" icon="refresh"
            onClick={() => askConfirm({
              title: 'Clear conversation context?',
              message: 'The active chat thread resets. Long-term memories are kept.',
              confirmLabel: 'Clear context',
              onConfirm: () => { newThread(); pushToast({ title: 'Context cleared', kind: 'success' }) },
            })}
          >
            Clear context
          </Button>
        </div>
        <div style={{ padding: 10 }}>
          {filtered.length === 0 ? (
            <EmptyState
              icon="brain"
              title={memories.length === 0 ? 'Memory is empty' : 'No matches'}
              sub={memories.length === 0
                ? 'Save facts, preferences and notes above — or ask U.L.T.R.0.N. to remember something.'
                : 'Try a different search term.'}
            />
          ) : filtered.map((m, i) => (
            <div key={m.id} className="row" style={{ animation: 'fadeUp 200ms cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${i * 30}ms` }}>
              <span className="row__icon" style={{ width: 30, height: 30 }}>
                <Icon name={m.kind === 'pref' ? 'settings' : m.kind === 'fact' ? 'info' : 'file'} width={13} />
              </span>
              <div className="row__main">
                <span className="row__title" style={{ fontSize: 12.5, fontWeight: 400, whiteSpace: 'normal', lineHeight: 1.5 }}>{m.text}</span>
                <span className="row__sub">{new Date(m.ts).toLocaleString()}</span>
              </div>
              <Button size="sm" variant="ghost" icon="trash" onClick={() => removeMemory(m.id)} title="Forget" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
