import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useUi } from './store/uiStore'
import { useAi, bootAssistant } from './store/aiStore'
import { useSettings } from './store/settingsStore'
import { startMetrics } from './store/dataStore'
import { startRecognition, startContinuousStt } from './lib/speech'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { CommandPalette } from './components/CommandPalette'
import { QuickMenu } from './components/QuickMenu'
import { NotificationsPanel } from './components/NotificationsPanel'
import { SettingsModal } from './components/SettingsModal'
import { ShortcutsModal } from './components/ShortcutsModal'
import { ConfirmHost } from './components/ui/ConfirmHost'
import { ToastHost } from './components/ui/ToastHost'
import { SetupWizard } from './components/SetupWizard'
import { ClipboardModal } from './components/ClipboardModal'
import { HomeView } from './views/HomeView'
import { ChatView } from './views/ChatView'

// Lazy-load heavier views — they mount only on first navigation
const ProjectsView = lazy(() => import('./views/ProjectsView').then((m) => ({ default: m.ProjectsView })))
const VoiceView = lazy(() => import('./views/VoiceView').then((m) => ({ default: m.VoiceView })))
const VisionView = lazy(() => import('./views/VisionView').then((m) => ({ default: m.VisionView })))
const ResearchView = lazy(() => import('./views/ResearchView').then((m) => ({ default: m.ResearchView })))
const FilesView = lazy(() => import('./views/FilesView').then((m) => ({ default: m.FilesView })))
const DevicesView = lazy(() => import('./views/DevicesView').then((m) => ({ default: m.DevicesView })))
const PhoneView = lazy(() => import('./views/PhoneView').then((m) => ({ default: m.PhoneView })))
const AutomationsView = lazy(() => import('./views/AutomationsView').then((m) => ({ default: m.AutomationsView })))
const MemoryView = lazy(() => import('./views/MemoryView').then((m) => ({ default: m.MemoryView })))
const CodeView = lazy(() => import('./views/CodeView').then((m) => ({ default: m.CodeView })))
const ToolsView = lazy(() => import('./views/ToolsView').then((m) => ({ default: m.ToolsView })))
const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })))

function Loading() {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <span className="spinner" style={{ width: 22, height: 22 }} />
    </div>
  )
}

export default function App() {
  const view = useUi((s) => s.view)
  const rightDock = useUi((s) => s.rightDock)
  const focusMode = useSettings((s) => s.settings.focusMode)
  const motion = useSettings((s) => s.settings.motion)
  const glass = useSettings((s) => s.settings.glass)
  const accent = useSettings((s) => s.settings.accent)
  const [collapsed, setCollapsed] = useState(false)
  const started = useRef(false)

  // Telemetry loop + assistant boot (briefing, reminder re-arm) start once
  if (!started.current) {
    started.current = true
    startMetrics()
    bootAssistant()
  }

  // CSS variable side-effects from settings
  useEffect(() => {
    document.documentElement.style.setProperty('--motion-scale', motion ? '1' : '0')
    document.documentElement.style.setProperty('--accent', accent)
  }, [motion, accent])

  useEffect(() => {
    if (!glass) {
      document.documentElement.style.setProperty('--panel', 'rgba(13, 19, 33, 0.98)')
    } else {
      document.documentElement.style.removeProperty('--panel')
    }
  }, [glass])

  // Global keyboard shortcuts + push-to-talk
  const pttRef = useRef<{ release: () => void } | null>(null)
  useEffect(() => {
    const startPtt = () => {
      if (pttRef.current) return
      useAi.setState({ state: 'listening' })
      useUi.getState().setView('chat')
      const session = startRecognition(
        (text) => { useAi.getState().setInput(text) },
        () => {
          pttRef.current = null
          useAi.setState({ state: 'idle' })
          const v = useAi.getState().input.trim()
          if (v) useAi.getState().send(v)
        },
      )
      if (session) pttRef.current = { release: () => session.stop() }
      else useAi.setState({ state: 'idle' })
    }
    const releasePtt = () => pttRef.current?.release()

    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.code === 'Space' && !e.repeat) { e.preventDefault(); startPtt(); return }
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'k') { e.preventDefault(); useUi.getState().openPalette() }
      else if (k === 'm') {
        e.preventDefault()
        useUi.getState().setView('voice')
        useUi.getState().pushToast({ title: 'Voice mode', body: 'Press Start listening to capture speech.', kind: 'info' })
      }
      else if (k === 'v' && e.shiftKey) { e.preventDefault(); useUi.getState().setClipboardOpen(true) }
      else if (e.key === '/') { e.preventDefault(); useUi.getState().setShortcutsOpen(true) }
      else if (k === ',') { e.preventDefault(); useUi.getState().setSettingsOpen(true) }
      else if (k === 'n' && e.shiftKey) { e.preventDefault(); useUi.getState().setNotifOpen(!useUi.getState().notifOpen) }
      else if (k === 'o' && e.shiftKey) { e.preventDefault(); useAi.getState().newThread(); useUi.getState().setView('chat') }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') releasePtt()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Wake word — "ultron" arms the composer (in-app; honest about scope)
  const wakeWord = useSettings((s) => s.settings.wakeWord)
  const wakeRef = useRef<{ stop: () => void } | null>(null)
  useEffect(() => {
    if (!wakeWord) {
      wakeRef.current?.stop()
      wakeRef.current = null
      return
    }
    if (wakeRef.current) return
    wakeRef.current = startContinuousStt(undefined, {
      onPartial: () => { /* only finals matter for the trigger */ },
      onFinal: (text) => {
        const t = text.toLowerCase()
        if (!/\bultron\b|\bultra on\b|\byou'ultron\b/.test(t)) return
        if (useAi.getState().streaming) return
        const remainder = text.slice(text.toLowerCase().search(/ultron|ultra on/i) + 6).replace(/^[,.\s]+/, '')
        useUi.getState().setView('chat')
        if (remainder.trim()) {
          useAi.getState().setInput(remainder)
          useAi.getState().send(remainder)
        } else {
          useUi.getState().pushToast({ title: 'Listening', body: 'Wake word heard — type or hold Ctrl+Space.', kind: 'info' })
        }
      },
      onError: (err) => {
        useUi.getState().pushToast({ title: 'Wake word', body: err, kind: 'error' })
        useSettings.getState().set('wakeWord', false)
      },
    })
    return () => {
      if (!wakeWord) { wakeRef.current?.stop(); wakeRef.current = null }
    }
  }, [wakeWord])

  const renderView = () => {
    switch (view) {
      case 'home': return <HomeView />
      case 'chat': return <ChatView />
      case 'projects': return <ProjectsView />
      case 'voice': return <VoiceView />
      case 'vision': return <VisionView />
      case 'research': return <ResearchView />
      case 'files': return <FilesView />
      case 'devices': return <DevicesView />
      case 'phone': return <PhoneView />
      case 'automations': return <AutomationsView />
      case 'memory': return <MemoryView />
      case 'code': return <CodeView />
      case 'tools': return <ToolsView />
      case 'settings': return <SettingsView />
      default: return <HomeView />
    }
  }

  return (
    <div className={`app ${focusMode ? 'focus-mode' : ''}`} data-accent={accent}>
      <TopBar sidebarCollapsed={collapsed} onToggleSidebar={() => setCollapsed((c) => !c)} />
      <div className="app-main">
        <div className="app-side">
          <Sidebar collapsed={collapsed} />
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)' }}>
            <div className="t-xs t-low" style={{ textAlign: 'center', lineHeight: 1.7 }}>
              <span className="brand-type" style={{ fontSize: 10.5 }}>U.L.T.R.0.N.</span>
              <div style={{ color: 'var(--text-faint)' }}>v1.0.0 · System Online</div>
            <a
              href="https://github.com/al13n-x-v0x"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-low)', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cyan)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-low)')}
            >
              @al13n-x-v0x
            </a>
            </div>
          </div>
        </div>

        <main className="app-content" key={view}>
          <div className="view-host">
            <Suspense fallback={<Loading />}>{renderView()}</Suspense>
          </div>
        </main>

        {rightDock === 'open' && <Dock />}
      </div>

      {/* Overlays */}
      <CommandPalette />
      <QuickMenu />
      <NotificationsPanel />
      <SettingsModal />
      <ShortcutsModal />
      <ClipboardModal />
      <ConfirmHost />
      <ToastHost />
      <SetupWizard />
    </div>
  )
}

/** Right dock — lazy so its code loads with the shell but its state stays local. */
function Dock() {
  const [Comp, setComp] = useState<null | React.ComponentType>(null)
  useEffect(() => {
    import('./components/panels/ControlsDock').then((m) => setComp(() => m.ControlsDock))
  }, [])
  return Comp ? <Comp /> : null
}
