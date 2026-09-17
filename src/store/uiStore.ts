import { create } from 'zustand'
import type { Mode, RightDock } from '../types'

export type RightTab = 'controls' | 'devices' | 'camera' | 'phone'

export interface UiState {
  view: string
  setView: (v: string) => void

  mode: Mode
  setMode: (m: Mode) => void

  rightTab: RightTab
  setRightTab: (t: RightTab) => void
  rightDock: RightDock
  setRightDock: (d: RightDock) => void

  paletteOpen: boolean
  openPalette: (prefill?: string) => void
  closePalette: () => void
  paletteQuery: string
  setPaletteQuery: (q: string) => void

  quickOpen: boolean
  setQuickOpen: (o: boolean) => void

  notifOpen: boolean
  setNotifOpen: (o: boolean) => void

  settingsOpen: boolean
  setSettingsOpen: (o: boolean) => void
  settingsSection: string
  setSettingsSection: (s: string) => void

  shortcutsOpen: boolean
  setShortcutsOpen: (o: boolean) => void

  clipboardOpen: boolean
  setClipboardOpen: (o: boolean) => void

  confirm: {
    open: boolean
    title: string
    message: string
    confirmLabel: string
    danger?: boolean
    onConfirm?: () => void
  }
  askConfirm: (opts: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }) => void
  closeConfirm: () => void

  toast: { id: number; title: string; body?: string; kind: 'success' | 'error' | 'info' } | null
  pushToast: (t: { title: string; body?: string; kind: 'success' | 'error' | 'info' }) => void
  clearToast: () => void
}

export const useUi = create<UiState>()((set) => ({
  view: 'home',
  setView: (v) => set({ view: v, quickOpen: false, paletteOpen: false }),

  mode: 'auto',
  setMode: (m) => set({ mode: m }),

  rightTab: 'controls',
  setRightTab: (t) => set({ rightTab: t, rightDock: 'open' }),
  rightDock: 'open',
  setRightDock: (d) => set({ rightDock: d }),

  paletteOpen: false,
  openPalette: (prefill) => {
    set({ paletteOpen: true, quickOpen: false, notifOpen: false, settingsOpen: false, paletteQuery: prefill ?? '' })
  },
  closePalette: () => set({ paletteOpen: false }),
  paletteQuery: '',
  setPaletteQuery: (q) => set({ paletteQuery: q }),

  quickOpen: false,
  setQuickOpen: (o) => set({ quickOpen: o }),

  notifOpen: false,
  setNotifOpen: (o) => set({ notifOpen: o }),

  settingsOpen: false,
  setSettingsOpen: (o) => set({ settingsOpen: o }),
  settingsSection: 'general',
  setSettingsSection: (s) => set({ settingsSection: s }),

  shortcutsOpen: false,
  setShortcutsOpen: (o) => set({ shortcutsOpen: o }),

  clipboardOpen: false,
  setClipboardOpen: (o) => set({ clipboardOpen: o }),

  confirm: { open: false, title: '', message: '', confirmLabel: 'Confirm' },
  askConfirm: (opts) => set({ confirm: { ...opts, open: true } }),
  closeConfirm: () => set({ confirm: { open: false, title: '', message: '', confirmLabel: 'Confirm' } }),

  toast: null,
  pushToast: (t) => set({ toast: { ...t, id: Date.now() } }),
  clearToast: () => set({ toast: null }),
}))
