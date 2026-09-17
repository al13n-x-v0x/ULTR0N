import { useEffect, useMemo, useRef, useState } from 'react'
import { useUi } from '../store/uiStore'
import { COMMANDS, filterCommands, type Command } from '../lib/commands'
import { Icon, type IconName } from './Icon'

type Frame = 'opening' | 'open' | 'executing' | 'success' | 'error' | 'closing'
type Tab = 'all' | string

interface RecentEntry { id: string; ts: number }
const RECENT_KEY = 'ultron.palette.recent.v1'

function loadRecent(): RecentEntry[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentEntry[] } catch { return [] }
}
function saveRecent(list: RecentEntry[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6))) } catch { /* ignore */ }
}

const CATEGORY_ICONS: Record<string, IconName> = {
  AI: 'spark', Chat: 'chat', Voice: 'mic', Vision: 'eye', Research: 'globe', Files: 'folder',
  Code: 'code', Devices: 'radar', Phone: 'phone', Camera: 'camera', Automation: 'bolt',
  Memory: 'brain', System: 'activity', Settings: 'settings',
}

const EXIT_MS = 160

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  const closePalette = useUi((s) => s.closePalette)
  const prefill = useUi((s) => s.paletteQuery)
  const pushToast = useUi((s) => s.pushToast)

  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [activeIdx, setActiveIdx] = useState(0)
  const [frame, setFrame] = useState<Frame>('opening')
  const [exec, setExec] = useState<{ cmd: Command; phase: 'run' | 'ok' | 'err' } | null>(null)
  const [recent, setRecent] = useState<RecentEntry[]>(loadRecent)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // Mount + open/close choreography
  useEffect(() => {
    if (open) {
      setMounted(true)
      setFrame('opening')
      setQuery(prefill ?? '')
      setTab('all')
      setActiveIdx(0)
      setExec(null)
      const t1 = window.setTimeout(() => setShown(true), 12)
      const t2 = window.setTimeout(() => { setFrame('open'); inputRef.current?.focus() }, 220)
      return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
    }
    // close: animate out, then unmount
    setShown(false)
    setFrame('closing')
    const t = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Preload recent labels for the empty-query view
  const recentCommands = useMemo(
    () => recent.map((r) => COMMANDS.find((c) => c.id === r.id)).filter((c): c is Command => !!c).slice(0, 4),
    [recent],
  )

  const categories = useMemo(() => Array.from(new Set(COMMANDS.map((c) => c.category))), [])
  const filtered = useMemo(() => {
    const base = tab === 'all' ? COMMANDS : COMMANDS.filter((c) => c.category === tab)
    return filterCommands(base, query)
  }, [tab, query])

  useEffect(() => { setActiveIdx(0) }, [query, tab])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, filtered.length])

  // Grouping for the results list (kept above any early return — Rules of Hooks)
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const c of filtered) {
      const arr = map.get(c.category) ?? []
      arr.push(c)
      map.set(c.category, arr)
    }
    return Array.from(map.entries())
  }, [filtered])

  if (!mounted) return null
  const closing = !open || frame === 'closing'

  const runCommand = (cmd: Command) => {
    if (exec) return
    setExec({ cmd, phase: 'run' })
    setFrame('executing')
    try {
      void Promise.resolve(cmd.action())
        .then(() => {
          setExec({ cmd, phase: 'ok' })
          setFrame('success')
          const next = [{ id: cmd.id, ts: Date.now() }, ...recent.filter((r) => r.id !== cmd.id)].slice(0, 6)
          setRecent(next)
          saveRecent(next)
          window.setTimeout(() => { closePalette(); window.setTimeout(() => setExec(null), 200) }, 460)
        })
        .catch((err) => {
          setExec({ cmd, phase: 'err' })
          setFrame('error')
          pushToast({ title: 'Command failed', body: err instanceof Error ? err.message : String(err), kind: 'error' })
          window.setTimeout(() => { setFrame('open'); setExec(null) }, 1500)
        })
    } catch (err) {
      setExec({ cmd, phase: 'err' })
      setFrame('error')
      pushToast({ title: 'Command failed', body: err instanceof Error ? err.message : String(err), kind: 'error' })
      window.setTimeout(() => { setFrame('open'); setExec(null) }, 1500)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); closePalette(); return }
    if (frame !== 'open') return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(filtered.length - 1, i + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)) }
    if (e.key === 'Enter' && filtered[activeIdx]) { e.preventDefault(); runCommand(filtered[activeIdx]) }
    if (e.key === 'Tab') {
      e.preventDefault()
      const idx = categories.indexOf(tab === 'all' ? '' : tab)
      const next = e.shiftKey ? (idx <= 0 ? categories.length - 1 : idx - 1) : (idx + 1) % categories.length
      setTab(categories[next] ?? 'all')
    }
  }

  const isExecuting = frame === 'executing' || frame === 'success' || frame === 'error'
  let flatIdx = -1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed', inset: 0, zIndex: 280,
        display: 'grid', placeItems: 'start center', paddingTop: '13vh',
        background: 'rgba(2,4,8,0.6)',
        backdropFilter: `blur(${shown ? 12 : 4}px)`,
        WebkitBackdropFilter: `blur(${shown ? 12 : 4}px)`,
        opacity: shown ? 1 : 0,
        transition: `opacity ${EXIT_MS}ms cubic-bezier(0.16,1,0.3,1), backdrop-filter 200ms ease`,
        pointerEvents: closing ? 'none' : 'auto',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) closePalette() }}
    >
      <div
        style={{
          width: 'min(640px, calc(100vw - 40px))',
          maxHeight: '62vh',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(10, 15, 27, 0.93)',
          border: '1px solid rgba(34,211,238,0.28)',
          borderRadius: 18,
          boxShadow: '0 30px 90px rgba(0,0,0,0.65), 0 0 40px rgba(34,211,238,0.08), 0 0 0 1px rgba(34,211,238,0.1)',
          transform: shown ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
          opacity: shown ? 1 : 0,
          transition: `transform ${EXIT_MS + 40}ms cubic-bezier(0.16,1,0.3,1), opacity ${EXIT_MS + 40}ms cubic-bezier(0.16,1,0.3,1)`,
          overflow: 'hidden',
        }}
      >
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <Icon
            name={exec && exec.phase === 'run' ? 'refresh' : 'search'}
            width={17}
            style={{ color: 'var(--cyan)', flex: 'none', animation: exec?.phase === 'run' ? 'spin 0.9s linear infinite' : undefined }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            aria-label="Search commands"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-hi)', fontSize: 15 }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" style={{ color: 'var(--text-faint)', cursor: 'pointer' }}>
              <Icon name="close" width={14} />
            </button>
          )}
          <span className="kbd">ESC</span>
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', gap: 5, padding: '9px 12px', borderBottom: '1px solid var(--line)', overflowX: 'auto', flex: 'none' }}>
          <CatTab label="All" active={tab === 'all'} onClick={() => setTab('all')} icon="grid" count={COMMANDS.length} />
          {categories.map((cat) => (
            <CatTab
              key={cat} label={cat} active={tab === cat}
              onClick={() => setTab(cat)}
              icon={CATEGORY_ICONS[cat] ?? 'circle'}
              count={COMMANDS.filter((c) => c.category === cat).length}
            />
          ))}
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 8, minHeight: 120 }}>
          {isExecuting && exec ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '22px 16px', animation: 'fadeIn 150ms ease both' }}>
              <span style={{
                width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', flex: 'none',
                background: exec.phase === 'ok' ? 'var(--ok-soft)' : exec.phase === 'err' ? 'var(--err-soft)' : 'var(--cyan-soft)',
                border: `1px solid ${exec.phase === 'ok' ? 'rgba(52,211,153,0.4)' : exec.phase === 'err' ? 'rgba(251,113,133,0.4)' : 'rgba(34,211,238,0.4)'}`,
                color: exec.phase === 'ok' ? 'var(--ok)' : exec.phase === 'err' ? 'var(--err)' : 'var(--cyan)',
                animation: exec.phase === 'run' ? 'pulseSoft 1s ease-in-out infinite' : 'popIn 180ms cubic-bezier(0.16,1,0.3,1) both',
              }}>
                <Icon name={exec.phase === 'ok' ? 'check' : exec.phase === 'err' ? 'alert' : (exec.cmd.icon as IconName)} width={18} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{exec.cmd.label}</div>
                <div className="t-sm t-mid" style={{ marginTop: 2 }}>
                  {exec.phase === 'run' ? 'Executing…' : exec.phase === 'ok' ? 'Completed' : 'Failed — see the toast for details'}
                </div>
              </div>
              {exec.phase === 'run' && <div className="progress" style={{ width: 120 }}><div className="progress-bar" /></div>}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty" style={{ padding: 30 }}>
              <Icon name="search" width={26} />
              <div className="empty-title">No commands match “{query}”</div>
              <div className="empty-sub">Try different keywords, or press Tab to switch category.</div>
            </div>
          ) : (
            <>
              {/* Recents when idle + unfiltered */}
              {!query && tab === 'all' && recentCommands.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div className="t-cap" style={{ color: 'var(--text-faint)', padding: '7px 10px 5px' }}>Recent</div>
                  {recentCommands.map((cmd) => {
                    const globalIdx = filtered.findIndex((c) => c.id === cmd.id)
                    return globalIdx >= 0 ? null : (
                      <CmdRow key={`r-${cmd.id}`} cmd={cmd} idx={-1} active={false} onHover={() => {}} onRun={runCommand} />
                    )
                  })}
                </div>
              )}
              {grouped.map(([cat, cmds]) => (
                <div key={cat} style={{ marginBottom: 6 }}>
                  <div className="t-cap" style={{ color: 'var(--text-faint)', padding: '7px 10px 5px' }}>{cat}</div>
                  {cmds.map((cmd) => {
                    flatIdx++
                    const idx = flatIdx
                    return (
                      <CmdRow
                        key={cmd.id} cmd={cmd} idx={idx}
                        active={idx === activeIdx}
                        onHover={() => setActiveIdx(idx)}
                        onRun={runCommand}
                      />
                    )
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 14px', borderTop: '1px solid var(--line)', color: 'var(--text-faint)', fontSize: 11 }}>
          <span><span className="kbd">↑↓</span> navigate</span>
          <span><span className="kbd">↵</span> run</span>
          <span><span className="kbd">Tab</span> category</span>
          <span style={{ marginLeft: 'auto' }} className="t-cap">U.L.T.R.0.N. · Command</span>
        </div>
      </div>
    </div>
  )
}

function CmdRow({ cmd, idx, active, onHover, onRun }: {
  cmd: Command
  idx: number
  active: boolean
  onHover: () => void
  onRun: (c: Command) => void
}) {
  return (
    <button
      data-idx={idx >= 0 ? idx : undefined}
      onMouseMove={onHover}
      onClick={() => onRun(cmd)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '9px 11px', borderRadius: 11, cursor: 'pointer',
        background: active ? 'rgba(34,211,238,0.09)' : 'transparent',
        border: `1px solid ${active ? 'rgba(34,211,238,0.28)' : 'transparent'}`,
        transition: 'background 100ms ease, border-color 100ms ease',
      }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', flex: 'none',
        background: active ? 'var(--cyan-soft)' : 'rgba(148,184,255,0.06)',
        border: `1px solid ${active ? 'rgba(34,211,238,0.3)' : 'var(--line)'}`,
        color: active ? 'var(--cyan)' : 'var(--text-mid)',
      }}>
        <Icon name={cmd.icon as IconName} width={15} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="ellipsis" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-hi)' }}>{cmd.label}</span>
        <span className="ellipsis" style={{ display: 'block', fontSize: 11.5, color: 'var(--text-low)' }}>{cmd.hint}</span>
      </span>
      {cmd.shortcut && (
        <span style={{ display: 'flex', gap: 4, flex: 'none' }}>
          {cmd.shortcut.split('+').map((k) => <span key={k} className="kbd">{k}</span>)}
        </span>
      )}
    </button>
  )
}

function CatTab({ label, active, onClick, icon, count }: { label: string; active: boolean; onClick: () => void; icon: IconName; count: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 27, padding: '0 10px', borderRadius: 99,
        fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none',
        color: active ? '#cffcff' : 'var(--text-low)',
        background: active ? 'var(--cyan-soft)' : 'transparent',
        border: `1px solid ${active ? 'rgba(34,211,238,0.4)' : 'transparent'}`,
        transition: 'all 120ms ease',
      }}
    >
      <Icon name={icon} width={12} />
      {label}
      <span style={{ opacity: 0.55, fontSize: 10 }}>{count}</span>
    </button>
  )
}
