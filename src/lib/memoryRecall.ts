/**
 * Long-term, size-unbounded memory with on-demand recall — the Mark-LIV approach:
 * "No size limit and nothing silently forgotten — the prompt carries what fits,
 * the rest is looked up on demand from a local search."
 *
 * We already persist memories in localStorage (memoryStore). This layer adds:
 *  - token-budgeted selection of what goes into the system prompt
 *  - lightweight relevance search over the rest
 *  - forgetting is explicit and user-driven only (nothing silently dropped)
 */
import { useMemory } from '../store/memoryStore'

/** Rough token estimate — good enough for budgeting (chars/4 heuristic). */
function estTokens(s: string): number {
  return Math.ceil(s.length / 4)
}

export interface MemoryWindow {
  /** Memories included in the system prompt (most recent, within budget). */
  inPrompt: string[]
  /** How many memories exist in total. */
  total: number
}

/**
 * Pick what fits in the prompt: newest first until the budget is spent.
 * Nothing is deleted — the overflow stays recallable via searchMemory().
 */
export function memoryWindow(maxTokens = 220): MemoryWindow {
  const all = useMemory.getState().memories
  const inPrompt: string[] = []
  let spent = 0
  for (const m of all) {
    const t = estTokens(m.text)
    if (spent + t > maxTokens) break
    inPrompt.push(m.text)
    spent += t
  }
  return { inPrompt, total: all.length }
}

/** On-demand recall: search the FULL memory store (including overflow). */
export function searchMemory(query: string, limit = 6): string[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const terms = q.split(/\s+/)
  const scored = useMemory
    .getState()
    .memories.map((m) => {
      const text = m.text.toLowerCase()
      let score = 0
      for (const t of terms) if (text.includes(t)) score += 1
      // recency tiebreaker
      return { m, score: score + m.ts / 1e15 }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
  return scored.map((x) => x.m.text)
}

/** One line for the system prompt describing how to use recall. */
export function recallHint(): string {
  const { inPrompt, total } = memoryWindow()
  if (total === 0) return ''
  const hidden = total - inPrompt.length
  const base = `MEMORY: You hold ${total} long-term fact${total === 1 ? '' : 's'} about the operator. The most recent are below — treat them as known.`
  return hidden > 0
    ? `${base} ${hidden} older memor${hidden === 1 ? 'y is' : 'ies are'} not shown; ask to search memory when unsure.\n${inPrompt.map((t) => `- ${t}`).join('\n')}`
    : `${base}\n${inPrompt.map((t) => `- ${t}`).join('\n')}`
}
