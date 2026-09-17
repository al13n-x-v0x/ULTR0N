import { useState } from 'react'
import { useData } from '../store/dataStore'
import { useUi } from '../store/uiStore'
import { Icon } from '../components/Icon'
import { Button } from '../components/ui/Button'
import { Ring } from '../components/ui/Meter'
import { EmptyState } from '../components/ui/StatusDot'
import type { Project } from '../types'

export function ProjectsView() {
  const projects = useData((s) => s.projects)
  const addProject = useData((s) => s.addProject)
  const pushToast = useUi((s) => s.pushToast)
  const [draft, setDraft] = useState('')

  const create = () => {
    const name = draft.trim()
    if (!name) return
    addProject(name)
    setDraft('')
    pushToast({ title: 'Project created', body: name, kind: 'success' })
  }

  return (
    <div className="anim-fade-up" style={{ padding: '22px 24px', maxWidth: 1000, margin: '0 auto' }}>
      <div className="view-head">
        <span className="row__icon"><Icon name="layers" /></span>
        <div style={{ flex: 1 }}>
          <h2>Projects</h2>
          <div className="t-xs t-low">Workspaces with progress, tags and status</div>
        </div>
      </div>

      <div className="panel" style={{ padding: 14, marginBottom: 14, display: 'flex', gap: 8 }}>
        <input
          className="input"
          placeholder="New project name…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create() }}
          aria-label="New project name"
        />
        <Button variant="primary" icon="plus" onClick={create} disabled={!draft.trim()}>Create</Button>
      </div>

      {projects.length === 0 ? (
        <div className="panel"><EmptyState icon="layers" title="No projects yet" sub="Create a workspace to organize tasks, files and context." /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {projects.map((p) => <ProjectCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ p }: { p: Project }) {
  const pushToast = useUi((s) => s.pushToast)
  const askConfirm = useUi((s) => s.askConfirm)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(p.name)
  const [desc, setDesc] = useState(p.desc)

  const save = () => {
    useData.setState({
      projects: useData.getState().projects.map((x) =>
        x.id === p.id ? { ...x, name: name.trim() || p.name, desc: desc.trim() || p.desc } : x,
      ),
    })
    setEditing(false)
    pushToast({ title: 'Project updated', kind: 'success' })
  }

  const remove = () => {
    askConfirm({
      title: `Delete "${p.name}"?`,
      message: 'The project card is removed. Files and memories are kept.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        useData.setState({ projects: useData.getState().projects.filter((x) => x.id !== p.id) })
        pushToast({ title: 'Project deleted', kind: 'success' })
      },
    })
  }

  return (
    <div className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Ring value={Math.round(p.progress * 100)} size={54} stroke={4.5} label={`${Math.round(p.progress * 100)}%`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input className="input" style={{ height: 30, marginBottom: 6 }} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          ) : (
            <div style={{ fontWeight: 600, fontSize: 14 }} className="ellipsis">{p.name}</div>
          )}
          {editing ? (
            <input className="input" style={{ height: 28, fontSize: 12 }} value={desc} onChange={(e) => setDesc(e.target.value)} />
          ) : (
            <div className="t-xs t-low clamp-2" style={{ lineHeight: 1.45 }}>{p.desc}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className={`badge badge--${p.status === 'active' ? 'ok' : p.status === 'paused' ? 'warn' : 'muted'}`}>{p.status}</span>
        {p.tags.map((t) => <span key={t} className="badge badge--muted">{t}</span>)}
        <span className="badge badge--muted">{new Date(p.created).toLocaleDateString()}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {editing ? (
          <>
            <Button size="sm" variant="primary" icon="check" onClick={save}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(true)}>Edit</Button>
            <Button size="sm" variant="ghost" icon="trash" title="Delete" onClick={remove} />
          </>
        )}
      </div>
    </div>
  )
}
