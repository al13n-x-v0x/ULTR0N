import { create } from 'zustand'
import { nextId } from '../lib/id'

export interface LongTermMemory {
  id: string
  text: string
  ts: number
  kind: 'note' | 'pref' | 'fact'
}

interface MemoryState {
  memories: LongTermMemory[]
  addMemory: (text: string, kind?: LongTermMemory['kind']) => void
  removeMemory: (id: string) => void
  clearAll: () => void
}

const KEY = 'ultron.memory.v1'

function load(): LongTermMemory[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as LongTermMemory[]
  } catch { /* ignore */ }
  return []
}

export const useMemory = create<MemoryState>()((set, get) => ({
  memories: load(),
  addMemory: (text, kind = 'note') => {
    const m: LongTermMemory = { id: nextId(), text, ts: Date.now(), kind }
    const next = [m, ...get().memories]
    set({ memories: next })
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  },
  removeMemory: (id) => {
    const next = get().memories.filter((m) => m.id !== id)
    set({ memories: next })
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  },
  clearAll: () => {
    set({ memories: [] })
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  },
}))
