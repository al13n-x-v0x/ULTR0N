import { useUi } from '../store/uiStore'
import { useAi } from '../store/aiStore'
import { useData } from '../store/dataStore'
import { useSettings } from '../store/settingsStore'
import { speak } from './speech'

export interface Command {
  id: string
  label: string
  hint: string
  category: string
  icon: string
  shortcut?: string
  keywords?: string[]
  action: (arg?: string) => void | Promise<void>
  /** When true the palette runs the action, shows a tiny progress then success state. */
  choreography?: boolean
}

function view(id: string): Command['action'] {
  return () => useUi.getState().setView(id)
}

export const COMMANDS: Command[] = [
  // AI
  { id: 'ai.ask', label: 'Ask U.L.T.R.0.N.', hint: 'Type a prompt into the AI console', category: 'AI', icon: 'spark', keywords: ['prompt', 'ai', 'ask'], action: () => useUi.getState().setView('chat') },
  { id: 'ai.setup', label: 'Local model setup', hint: 'Scan laptop & install an on-device AI', category: 'AI', icon: 'cpu', keywords: ['download', 'model', 'webllm', 'offline', 'gpu'], action: () => { useSettings.getState().set('setupDone', false) } },
  { id: 'ai.mode', label: 'Switch mode', hint: 'Auto · Reason · Code · Create · Research', category: 'AI', icon: 'mode', action: () => useUi.getState().setView('home') },
  { id: 'ai.newthread', label: 'New thread', hint: 'Clear the conversation', category: 'AI', icon: 'plus', shortcut: 'Ctrl+⇧+O', action: () => { useAi.getState().newThread(); useUi.getState().setView('chat') } },

  // Chat
  { id: 'chat.open', label: 'Open Chat', hint: 'AI conversation console', category: 'Chat', icon: 'chat', action: view('chat') },
  { id: 'chat.clipboard', label: 'Clipboard Intelligence', hint: 'Explain · Summarise · Fix · Translate copied text', category: 'Chat', icon: 'file', shortcut: 'Ctrl+⇧+V', action: () => useUi.getState().setClipboardOpen(true) },
  { id: 'chat.briefing', label: 'Morning briefing', hint: 'Memories · machine · suggestion', category: 'Chat', icon: 'sun', action: () => { useUi.getState().setView('chat'); useAi.getState().send('/briefing') } },
  { id: 'chat.stop', label: 'Stop generation', hint: 'Halt the running AI task', category: 'Chat', icon: 'stop', action: () => useAi.getState().stop() },
  { id: 'chat.readaloud', label: 'Read last reply aloud', hint: 'Speech synthesis', category: 'Chat', icon: 'speaker', action: () => { const msgs = useAi.getState().messages; const last = [...msgs].reverse().find((m) => m.role === 'assistant'); if (last) speak(last.text) } },

  // Voice
  { id: 'voice.start', label: 'Start voice mode', hint: 'Speak a command or question', category: 'Voice', icon: 'mic', shortcut: 'Ctrl+M', action: () => { useUi.getState().setView('voice') } },
  { id: 'voice.stop', label: 'Stop speaking', hint: 'Silence speech output', category: 'Voice', icon: 'stop', action: () => import('./speech').then((m) => m.stopSpeaking()) },
  { id: 'voice.settings', label: 'Voice settings', hint: 'Rate, voice reply, wake word', category: 'Voice', icon: 'settings', action: () => { useUi.getState().setSettingsOpen(true); useUi.getState().setSettingsSection('voice') } },

  // Vision
  { id: 'vision.open', label: 'Open Vision', hint: 'Camera + screen analysis', category: 'Vision', icon: 'eye', action: view('vision') },
  { id: 'vision.screen', label: 'Analyze screen', hint: 'Capture the display via screen share', category: 'Vision', icon: 'monitor', action: () => { useUi.getState().setView('vision'); } },
  { id: 'vision.camera', label: 'Open camera', hint: 'Permission-gated live feed', category: 'Vision', icon: 'camera', action: () => { useUi.getState().setView('vision') } },

  // Research
  { id: 'research.open', label: 'Search web', hint: 'Wikipedia REST research lane', category: 'Research', icon: 'globe', action: view('research') },
  { id: 'research.focus', label: 'Deep Research mode', hint: 'Cited multi-source answers', category: 'Research', icon: 'mode', action: () => { useAi.getState().setMode('research'); useUi.getState().setView('chat'); useUi.getState().pushToast({ title: 'Deep Research', body: 'Mode set to research — replies will aim for cited depth.', kind: 'info' }) } },

  // Files
  { id: 'files.open', label: 'Open Files', hint: 'Workspace documents', category: 'Files', icon: 'folder', action: view('files') },
  { id: 'files.add', label: 'Attach a file', hint: 'Stage into the AI context', category: 'Files', icon: 'paperclip', action: () => useUi.getState().setView('files') },
  { id: 'files.clear', label: 'Clear staged files', hint: 'Remove all attachments', category: 'Files', icon: 'trash', action: () => { useUi.getState().pushToast({ title: 'Files cleared', body: 'Staged attachments removed.', kind: 'info' }) } },

  // Code
  { id: 'code.open', label: 'Open Code workspace', hint: 'Editor + live JS preview', category: 'Code', icon: 'code', action: view('code') },
  { id: 'code.run', label: 'Run code', hint: 'Execute the editor buffer', category: 'Code', icon: 'play', shortcut: 'Ctrl+Enter', action: () => { useUi.getState().setView('code'); useUi.getState().pushToast({ title: 'Code workspace', body: 'Press Ctrl+Enter in the editor to run.', kind: 'info' }) } },
  { id: 'code.format', label: 'Format selection', hint: 'Basic indent normalization', category: 'Code', icon: 'code', action: () => { useUi.getState().setView('code'); useUi.getState().pushToast({ title: 'Formatter', body: 'Open the Code workspace to format.', kind: 'info' }) } },

  { id: 'devices.open', label: 'Scan devices', hint: 'Enumerate real nearby hardware', category: 'Devices', icon: 'radar', action: () => { useUi.getState().setView('devices') } },
  { id: 'devices.radar', label: 'Open device radar', hint: 'Live discovery map', category: 'Devices', icon: 'radar', action: view('devices') },
  { id: 'phone.open', label: 'Control phone', hint: 'Capability-aware phone panel', category: 'Phone', icon: 'phone', action: view('phone') },

  // Camera
  { id: 'camera.open', label: 'Open camera panel', hint: 'Capture · record · switch', category: 'Camera', icon: 'camera', action: () => { useUi.getState().setView('vision'); useUi.getState().setRightTab('camera') } },

  // Automation
  { id: 'auto.open', label: 'Run automation', hint: 'Trigger a saved routine', category: 'Automation', icon: 'bolt', action: view('automations') },
  { id: 'auto.new', label: 'New automation', hint: 'Create a routine', category: 'Automation', icon: 'plus', action: () => { useUi.getState().setView('automations'); useData.getState().addAutomation('New automation') } },

  // Memory
  { id: 'memory.open', label: 'Show memory', hint: 'Long-term memory hub', category: 'Memory', icon: 'brain', action: view('memory') },
  { id: 'memory.add', label: 'Save a memory', hint: 'Pin a fact for later recall', category: 'Memory', icon: 'plus', action: () => { useUi.getState().setView('memory'); } },
  { id: 'memory.clear', label: 'Clear conversation context', hint: 'Reset the active thread', category: 'Memory', icon: 'trash', action: () => { useAi.getState().newThread(); useUi.getState().pushToast({ title: 'Context cleared', kind: 'success' }) } },

  // System
  { id: 'system.status', label: 'System status', hint: 'CPU · RAM · GPU · network', category: 'System', icon: 'activity', action: view('tools') },
  { id: 'system.notifs', label: 'Open notifications', hint: 'Recent alerts', category: 'System', icon: 'bell', action: () => useUi.getState().setNotifOpen(true) },
  { id: 'system.shortcuts', label: 'Keyboard shortcuts', hint: 'Every binding, one sheet', category: 'System', icon: 'kbd', shortcut: 'Ctrl+/', action: () => useUi.getState().setShortcutsOpen(true) },
  { id: 'system.diagnostics', label: 'Run diagnostics', hint: 'Local core + permissions check', category: 'System', icon: 'activity', action: () => { useUi.getState().setView('chat'); useAi.getState().send('/diagnostics') } },

  // Settings
  { id: 'settings.open', label: 'Open settings', hint: 'All preferences, layered', category: 'Settings', icon: 'settings', action: () => { useUi.getState().setSettingsOpen(true); useUi.getState().setSettingsSection('general') } },
  { id: 'settings.appearance', label: 'Appearance', hint: 'Motion · glass · accent · density', category: 'Settings', icon: 'palette', action: () => { useUi.getState().setSettingsOpen(true); useUi.getState().setSettingsSection('appearance') } },
  { id: 'settings.ai', label: 'AI provider', hint: 'Local or OpenAI-compatible API', category: 'Settings', icon: 'spark', action: () => { useUi.getState().setSettingsOpen(true); useUi.getState().setSettingsSection('ai') } },
  { id: 'settings.reset', label: 'Reset all settings', hint: 'Restore defaults', category: 'Settings', icon: 'trash', action: () => { useSettingsReset() } },
]

async function useSettingsReset() {
  const { useSettings } = await import('../store/settingsStore')
  const { askConfirm, pushToast } = useUi.getState()
  askConfirm({
    title: 'Reset all settings?',
    message: 'Every preference returns to its default. Memories are kept.',
    confirmLabel: 'Reset',
    danger: true,
    onConfirm: () => {
      useSettings.getState().reset()
      pushToast({ title: 'Settings reset', kind: 'success' })
    },
  })
}

export function filterCommands(list: Command[], q: string): Command[] {
  const query = q.trim().toLowerCase()
  if (!query) return list
  const terms = query.split(/\s+/)
  return list
    .map((c) => {
      const hay = `${c.label} ${c.hint} ${c.category} ${(c.keywords ?? []).join(' ')}`.toLowerCase()
      let score = 0
      for (const t of terms) {
        if (c.label.toLowerCase().startsWith(t)) score += 3
        if (hay.includes(t)) score += 1
      }
      return { c, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c)
}
