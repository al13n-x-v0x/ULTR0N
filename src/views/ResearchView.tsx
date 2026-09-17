import { useCallback, useEffect, useRef, useState } from 'react'
import { useAi } from '../store/aiStore'
import { useUi } from '../store/uiStore'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/StatusDot'

interface WikiHit {
  id: number
  key: string
  title: string
  excerpt: string
  description?: string
}

export function ResearchView() {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<WikiHit[]>([])
  const [detail, setDetail] = useState<{ title: string; extract: string; url: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'searching' | 'loading' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [offline, setOffline] = useState(!navigator.onLine)
  const seq = useRef(0)
  const pushToast = useUi((s) => s.pushToast)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const search = useCallback(async (q: string) => {
    const term = q.trim()
    if (!term || !navigator.onLine) return
    const my = ++seq.current
    setStatus('searching'); setDetail(null); setErrMsg('')
    try {
      const u = new URL('https://en.wikipedia.org/w/rest.php/v1/search/page')
      u.searchParams.set('q', term)
      u.searchParams.set('limit', '8')
      const res = await fetch(u, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`Search failed (${res.status})`)
      const json = (await res.json()) as { pages: WikiHit[] }
      if (seq.current !== my) return
      setHits(json.pages ?? [])
      setStatus('idle')
      if (!json.pages?.length) pushToast({ title: 'No results', body: `Nothing found for “${term}”.`, kind: 'info' })
    } catch (err) {
      if (seq.current !== my) return
      setStatus('error')
      setErrMsg(err instanceof Error ? err.message : String(err))
    }
  }, [pushToast])

  // Debounced live search
  useEffect(() => {
    const t = window.setTimeout(() => { if (query.trim().length >= 3) void search(query) }, 380)
    return () => window.clearTimeout(t)
  }, [query, search])

  const open = async (hit: WikiHit) => {
    if (!navigator.onLine) return
    const my = ++seq.current
    setStatus('loading')
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.key)}`)
      if (!res.ok) throw new Error(`Summary failed (${res.status})`)
      const j = (await res.json()) as { title: string; extract: string; content_urls?: { desktop: { page: string } } }
      if (seq.current !== my) return
      setDetail({
        title: j.title ?? hit.title,
        extract: j.extract ?? 'No summary available.',
        url: j.content_urls?.desktop.page ?? `https://en.wikipedia.org/wiki/${hit.key}`,
      })
      setStatus('idle')
    } catch (err) {
      if (seq.current !== my) return
      setStatus('error')
      setErrMsg(err instanceof Error ? err.message : String(err))
    }
  }

  const askAi = () => {
    const text = detail
      ? `Summarize this for me: ${detail.title} — ${detail.extract.slice(0, 300)}`
      : `Research topic: ${query}`
    useAi.getState().setInput(text)
    useUi.getState().setView('chat')
    pushToast({ title: 'Sent to chat', body: 'Review and press Enter to run.', kind: 'info' })
  }

  return (
    <div className="anim-fade-up" style={{ padding: '22px 24px', maxWidth: 980, margin: '0 auto' }}>
      <div className="view-head">
        <span className="row__icon"><Icon name="globe" /></span>
        <div style={{ flex: 1 }}>
          <h2>Research</h2>
          <div className="t-xs t-low">Live web knowledge via Wikipedia's public REST API</div>
        </div>
        {offline && <span className="badge badge--err">OFFLINE — search unavailable</span>}
      </div>

      <div className="panel" style={{ padding: 12, marginBottom: 14 }}>
        <div className="input-wrap">
          <Icon name="search" width={15} />
          <input
            className="input"
            placeholder="Search Wikipedia… (min 3 characters)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void search(query) }}
            aria-label="Search Wikipedia"
          />
          {status === 'searching' && <span className="spinner" style={{ position: 'absolute', right: 12 }} />}
        </div>
      </div>

      {status === 'error' && (
        <div className="panel" style={{ padding: 14, marginBottom: 14, borderColor: 'rgba(251,113,133,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--err)', fontSize: 13 }}>
            <Icon name="alert" width={15} /> {errMsg}
          </div>
          <Button size="sm" style={{ marginTop: 10 }} icon="refresh" onClick={() => void search(query)}>Retry</Button>
        </div>
      )}

      {detail && (
        <div className="panel anim-pop" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="file" width={16} style={{ color: 'var(--cyan)' }} />
            <h3 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{detail.title}</h3>
            <Button size="sm" variant="primary" icon="spark" onClick={askAi}>Ask U.L.T.R.0.N.</Button>
            <a className="btn btn--sm" href={detail.url} target="_blank" rel="noreferrer">Open source ↗</a>
          </div>
          <p className="t-sm t-mid" style={{ marginTop: 10, lineHeight: 1.65 }}>{detail.extract}</p>
        </div>
      )}

      {hits.length === 0 && status === 'idle' ? (
        <div className="panel">
          <EmptyState
            icon="globe"
            title={offline ? 'You are offline' : 'Start researching'}
            sub={offline
              ? 'Web research needs a connection. The local AI core, memory and tools keep working offline.'
              : 'Results stream in as you type — click a card for the full summary, then hand it to the AI core.'}
          />
        </div>
      ) : (
        <div className="wiki-grid">
          {hits.map((h, i) => (
            <button
              key={h.id}
              className="panel wiki-card anim-fade-up"
              style={{ animationDelay: `${i * 35}ms` }}
              onClick={() => void open(h)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }} className="ellipsis">{h.title}</span>
                <Icon name="arrowR" width={13} style={{ color: 'var(--text-faint)' }} />
              </div>
              {h.description && <div className="t-xs t-cyan" style={{ marginTop: 3 }}>{h.description}</div>}
              <div
                className="t-sm t-mid"
                style={{ marginTop: 7, lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: sanitizeExcerpt(h.excerpt) }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Wikipedia excerpts contain <span class="searchmatch"> highlights — strip tags, keep text. */
function sanitizeExcerpt(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent ?? ''
}
