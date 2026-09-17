import { useMemo, useRef, useState } from 'react'
import { useData } from '../store/dataStore'
import { useAi } from '../store/aiStore'
import { useUi } from '../store/uiStore'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { Toggle } from '../components/ui/Toggle'
import { EmptyState } from '../components/ui/StatusDot'
import { generateViralCopy } from '../lib/skills'
import { bridgeHealth, bridgeYoutubeUpload, bridgeYoutubeJob, bridgeBurnSubtitles } from '../lib/bridge'
import { readingSpeedCues, toSrt } from '../lib/subtitles'
import type { PublishItem, PublishStatus } from '../types'

const STATUS_META: Record<PublishStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--text-low)' },
  writing: { label: 'Writing title…', color: 'var(--warn)' },
  ready: { label: 'Ready', color: 'var(--cyan)' },
  uploading: { label: 'Uploading…', color: 'var(--warn)' },
  done: { label: 'Live', color: 'var(--ok)' },
  error: { label: 'Failed', color: 'var(--err)' },
}

export function FilesView() {
  const [tab, setTab] = useState<'workspace' | 'publish'>('workspace')

  return (
    <div className="anim-fade-up" style={{ padding: '22px 24px', maxWidth: 880, margin: '0 auto' }}>
      <div className="view-head">
        <span className="row__icon"><Icon name="folder" /></span>
        <div style={{ flex: 1 }}>
          <h2>Files</h2>
          <div className="t-xs t-low">Workspace documents · publish queue for YouTube uploads</div>
        </div>
        <div className="seg">
          <button data-active={tab === 'workspace'} onClick={() => setTab('workspace')}>Workspace</button>
          <button data-active={tab === 'publish'} onClick={() => setTab('publish')}>Publish queue</button>
        </div>
      </div>
      {tab === 'workspace' ? <WorkspaceTab /> : <PublishTab />}
    </div>
  )
}

/* ------------------------- Workspace tab ------------------------- */

function WorkspaceTab() {
  const files = useData((s) => s.files)
  const addFile = useData((s) => s.addFile)
  const removeFile = useData((s) => s.removeFile)
  const updateFile = useData((s) => s.updateFile)
  const attachments = useAi((s) => s.attachments)
  const pushToast = useUi((s) => s.pushToast)
  const askConfirm = useUi((s) => s.askConfirm)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [pathFor, setPathFor] = useState<string | null>(null)
  const [pathDraft, setPathDraft] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files
  }, [files, query])

  const onPick = (fl: FileList | null) => {
    if (!fl) return
    Array.from(fl).forEach((f) => {
      addFile({ name: f.name, kind: f.type || 'file', size: fmtSize(f.size) })
      attach({ id: `att_${Date.now()}_${f.name}`, name: f.name, kind: f.type || 'file', size: f.size })
    })
    pushToast({ title: 'Files staged', body: `${fl.length} file(s) attached to AI context.`, kind: 'success' })
  }
  const attach = useAi((s) => s.attach)

  const isVideo = (f: { kind: string; name: string }) => f.kind.startsWith('video') || /\.(mp4|mov|mkv|webm|avi)$/i.test(f.name)

  return (
    <>
      <div className="panel" style={{ padding: 12, marginBottom: 14, display: 'flex', gap: 10 }}>
        <div className="input-wrap" style={{ flex: 1 }}>
          <Icon name="search" width={14} />
          <input className="input" placeholder="Search files…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search files" />
        </div>
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => { onPick(e.target.files); e.target.value = '' }} />
        <Button variant="primary" icon="plus" onClick={() => fileRef.current?.click()}>Add files</Button>
      </div>

      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="t-xs t-low" style={{ alignSelf: 'center' }}>Staged in AI context:</span>
          {attachments.map((a) => (
            <span key={a.id} className="chip" data-active="true">
              <Icon name="paperclip" width={11} />
              {a.name}
              <button onClick={() => useAi.getState().detach(a.id)} aria-label={`Detach ${a.name}`}>
                <Icon name="close" width={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="panel">
        <div style={{ padding: 10 }}>
          {filtered.length === 0 ? (
            <EmptyState
              icon="folder"
              title={files.length === 0 ? 'No files yet' : 'No matches'}
              sub={files.length === 0 ? 'Add files to stage them for AI analysis. Nothing is uploaded — processing stays local unless you use a remote provider.' : undefined}
            />
          ) : filtered.map((f) => (
            <div key={f.id}>
              <div className="row">
                <span className="row__icon">
                  <Icon name={f.kind.startsWith('image') ? 'eye' : isVideo(f) ? 'play' : f.name.endsWith('.md') ? 'file' : 'code'} width={15} />
                </span>
                <div className="row__main">
                  <span className="row__title">{f.name}</span>
                  <span className="row__sub">
                    {f.kind} · {f.size} · {new Date(f.ts).toLocaleString()}
                    {f.path && <span style={{ color: 'var(--ok)' }}> · bridge path set</span>}
                  </span>
                </div>
                {isVideo(f) && (
                  <Button size="sm" icon="arrowR" onClick={() => { setPathFor(f.id); setPathDraft(f.path ?? '') }} title="Set laptop path for upload">
                    {f.path ? 'Edit path' : 'Publish'}
                  </Button>
                )}
                <Button
                  size="sm" variant="ghost" icon="trash"
                  onClick={() => askConfirm({
                    title: `Remove "${f.name}"?`,
                    message: 'The file entry is removed from the workspace list.',
                    confirmLabel: 'Remove',
                    danger: true,
                    onConfirm: () => { removeFile(f.id); pushToast({ title: 'File removed', kind: 'success' }) },
                  })}
                />
              </div>
              {pathFor === f.id && (
                <div style={{ display: 'flex', gap: 8, padding: '4px 10px 10px 46px', alignItems: 'center' }}>
                  <input
                    className="input mono" style={{ flex: 1, fontSize: 12 }}
                    placeholder="C:\videos\clip.mp4 — the path on YOUR laptop the bridge uploads from"
                    value={pathDraft}
                    onChange={(e) => setPathDraft(e.target.value)}
                    aria-label="Laptop file path"
                  />
                  <Button size="sm" variant="primary" icon="check" onClick={() => {
                    updateFile(f.id, { path: pathDraft.trim() || undefined })
                    setPathFor(null)
                    pushToast({
                      title: pathDraft.trim() ? 'Path saved' : 'Path cleared',
                      body: pathDraft.trim() ? 'Queue it from the Publish tab.' : undefined,
                      kind: 'success',
                    })
                  }}>Save</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* ------------------------- Publish queue tab ------------------------- */

function PublishTab() {
  const files = useData((s) => s.files)
  const queue = useData((s) => s.publishQueue)
  const addPublish = useData((s) => s.addPublish)
  const removePublish = useData((s) => s.removePublish)
  const askConfirm = useUi((s) => s.askConfirm)
  const pushToast = useUi((s) => s.pushToast)
  const [newPath, setNewPath] = useState('')
  const [newTopic, setNewTopic] = useState('')

  const videos = files.filter((f) => f.path)
  const queueWithFiles: (PublishItem & { fileMissing?: boolean })[] = queue.map((q) => ({
    ...q,
    fileMissing: !videos.some((f) => f.path === q.path) && !/^([a-zA-Z]:\\|\/|~)/.test(q.path),
  }))

  const queueIt = () => {
    if (!newPath.trim()) {
      pushToast({ title: 'Add a path', body: 'Set a laptop path on a video in the Workspace tab, or type one here.', kind: 'info' })
      return
    }
    addPublish({ fileName: newPath.split(/[\\/]/).pop() ?? newPath, path: newPath.trim(), topic: newTopic.trim(), privacy: 'unlisted' })
    setNewPath('')
    setNewTopic('')
    pushToast({ title: 'Queued', body: 'Write the title, then send it up.', kind: 'success' })
  }

  return (
    <>
      <div className="panel" style={{ padding: 14, marginBottom: 14 }}>
        <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 8 }}>Queue a video</div>
        {videos.length === 0 && (
          <div className="t-xs t-low" style={{ marginBottom: 8, lineHeight: 1.6 }}>
            Tip: in the Workspace tab, press <strong>Publish</strong> on a video to give it a laptop path — then it appears here ready to go.
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input mono" style={{ flex: 2, minWidth: 220, fontSize: 12 }}
            placeholder="C:\videos\clip.mp4"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            aria-label="Video path"
          />
          <input
            className="input" style={{ flex: 2, minWidth: 180 }}
            placeholder="Topic — e.g. 30 days of learning guitar"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') queueIt() }}
            aria-label="Video topic"
          />
          <Button variant="primary" icon="plus" onClick={queueIt}>Queue</Button>
        </div>
        {videos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <span className="t-xs t-low" style={{ alignSelf: 'center' }}>Ready from workspace:</span>
            {videos.map((f) => (
              <button key={f.id} className="chip" title={f.path} onClick={() => {
                addPublish({ fileName: f.name, path: f.path!, topic: '', privacy: 'unlisted' })
                pushToast({ title: 'Queued', body: f.name, kind: 'success' })
              }}>
                <Icon name="play" width={11} />
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="panel">
          <EmptyState icon="arrowR" title="Publish queue is empty" sub="Queue a video above — U.L.T.R.0.N. writes the viral title, you preview it, then it uploads via the bridge." />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {queueWithFiles.map((item) => <PublishCard key={item.id} item={item} onRemove={(id) => askConfirm({
            title: 'Remove from queue?',
            message: item.status === 'done' ? 'The entry (and its link) will be removed.' : 'The draft and its generated copy will be removed.',
            confirmLabel: 'Remove',
            danger: true,
            onConfirm: () => removePublish(id),
          })} />)}
        </div>
      )}
    </>
  )
}

function PublishCard({ item, onRemove }: { item: PublishItem & { fileMissing?: boolean }; onRemove: (id: string) => void }) {
  const updatePublish = useData((s) => s.updatePublish)
  const pushToast = useUi((s) => s.pushToast)
  const [topic, setTopic] = useState(item.topic)
  const [privacy, setPrivacy] = useState(item.privacy)
  const meta = STATUS_META[item.status]

  const writeTitle = async () => {
    updatePublish(item.id, { status: 'writing', error: undefined })
    try {
      const copy = await generateViralCopy(topic || item.fileName.replace(/\.\w+$/, ''), 'youtube')
      // Build SRT cues from reading-speed pacing (honest mode — no narration timing)
      const cues = readingSpeedCues(copy.spokenCaption)
      updatePublish(item.id, {
        hook: copy.hook,
        caption: copy.caption,
        hashtags: copy.hashtags,
        spokenCaption: copy.spokenCaption,
        thumbIdeas: copy.thumbIdeas,
        srt: toSrt(cues),
        status: 'ready',
        topic,
      })
    } catch (err) {
      updatePublish(item.id, { status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  const send = async () => {
    if (!item.hook) return
    updatePublish(item.id, { status: 'uploading', privacy, error: undefined })
    try {
      const h = await bridgeHealth()
      if (!h.ok) throw new Error('Bridge not running — node bridge/ultron-bridge.mjs (see bridge/README.md)')
      if (!h.youtubeConfigured) throw new Error('Bridge needs GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (bridge/README.md)')
      let uploadPath = item.path
      if (item.burnCaptions && item.srt) {
        if (!h.ffmpeg) throw new Error('ffmpeg not found on the laptop — install it or set FFMPEG_PATH for the bridge')
        pushToast({ title: 'Burning captions…', body: 'One ffmpeg pass, big files take a bit.', kind: 'info' })
        uploadPath = await bridgeBurnSubtitles(item.path, item.srt)
      }
      const jobId = await bridgeYoutubeUpload(uploadPath, {
        title: item.hook.slice(0, 100),
        description: `${item.caption ?? ''}\n\n${(item.hashtags ?? []).join(' ')}`.trim(),
        tags: (item.hashtags ?? []).map((t) => t.replace('#', '')),
        privacy,
        mimeType: 'video/mp4',
      })
      // Poll in the background; update the card when it lands
      const poll = async () => {
        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          const job = await bridgeYoutubeJob(jobId).catch(() => null)
          if (job?.status === 'done') { updatePublish(item.id, { status: 'done', videoId: job.videoId }); return }
          if (job?.status === 'error') { updatePublish(item.id, { status: 'error', error: job.error }); return }
        }
        updatePublish(item.id, { status: 'error', error: 'Upload timed out — check the bridge console.' })
      }
      void poll()
    } catch (err) {
      updatePublish(item.id, { status: 'error', error: err instanceof Error ? err.message : String(err) })
      pushToast({ title: 'Upload failed', body: err instanceof Error ? err.message : String(err), kind: 'error' })
    }
  }

  return (
    <div className="panel" style={{ padding: 14, borderColor: item.status === 'ready' ? 'rgba(34,211,238,0.35)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span className="row__icon"><Icon name="play" width={15} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }} className="ellipsis">{item.fileName}</div>
          <div className="mono t-xs t-low ellipsis">{item.path}</div>
        </div>
        <span className="badge" style={{ color: meta.color, borderColor: meta.color }}>{meta.label}</span>
        <Button size="sm" variant="ghost" icon="trash" onClick={() => onRemove(item.id)} aria-label="Remove from queue" />
      </div>

      {item.status === 'done' && item.videoId ? (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--ok-soft)', border: '1px solid rgba(52,211,153,0.35)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ok)' }}>Uploaded — {item.hook}</div>
          <a href={`https://youtu.be/${item.videoId}`} target="_blank" rel="noreferrer" className="mono t-sm" style={{ color: 'var(--cyan)' }}>
            youtu.be/{item.videoId}
          </a>
          <div className="t-xs t-low" style={{ marginTop: 4 }}>Privacy: {item.privacy} — change it in YouTube Studio anytime.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="input" style={{ flex: 1 }}
              placeholder="Topic for the AI (what's the video about?)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              aria-label="Topic"
            />
            <Button size="sm" icon="spark" onClick={() => void writeTitle()} disabled={item.status === 'writing' || item.status === 'uploading'}>
              {item.status === 'writing' ? 'Writing…' : item.hook ? 'Rewrite' : 'Write title'}
            </Button>
          </div>

          {item.hook && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.25)', marginBottom: 8 }}>
              <div className="t-cap" style={{ color: 'var(--cyan)', marginBottom: 4 }}>AI-generated preview</div>
              <div style={{ fontWeight: 650, fontSize: 14, lineHeight: 1.4 }}>{item.hook}</div>
              {item.caption && <div className="t-sm t-mid" style={{ marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{item.caption}</div>}
              {item.hashtags && item.hashtags.length > 0 && (
                <div className="mono t-xs" style={{ marginTop: 6, color: 'var(--text-low)' }}>{item.hashtags.join(' ')}</div>
              )}
            </div>
          )}

          {item.thumbIdeas && item.thumbIdeas.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div className="t-cap" style={{ color: 'var(--text-faint)', marginBottom: 5 }}>Thumbnail text ideas — big font, 3 words max</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {item.thumbIdeas.map((idea, i) => (
                  <div
                    key={i}
                    style={{
                      width: 148, height: 84, borderRadius: 8, padding: 8,
                      display: 'grid', placeItems: 'center', textAlign: 'center',
                      background: 'linear-gradient(135deg, #0b1120, #16233d)',
                      border: '1px solid rgba(34,211,238,0.3)',
                      color: '#eaf6ff', fontWeight: 800, fontSize: 15, lineHeight: 1.15,
                      textShadow: '0 2px 6px rgba(0,0,0,0.7)',
                      letterSpacing: '0.02em', textTransform: 'uppercase',
                    }}
                  >
                    {idea}
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.srt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Toggle
                on={!!item.burnCaptions}
                onChange={(v) => updatePublish(item.id, { burnCaptions: v })}
                label="Burn captions into the video"
              />
              <span className="t-xs t-low">ffmpeg burns the caption SRT in one pass before upload</span>
            </div>
          )}

          {item.error && (
            <div className="t-sm" style={{ color: 'var(--err)', marginBottom: 8, lineHeight: 1.5 }}>✗ {item.error}</div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="seg" style={{ flex: 'none' }}>
              {(['unlisted', 'public', 'private'] as const).map((p) => (
                <button key={p} data-active={privacy === p} onClick={() => setPrivacy(p)}>{p}</button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <Button
              variant="primary" icon="arrowR"
              onClick={() => void send()}
              disabled={item.status !== 'ready'}
              title={item.status !== 'ready' ? 'Write the title first' : 'Upload via the bridge'}
            >
              {item.status === 'uploading' ? 'Uploading…' : 'Send to YouTube'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
