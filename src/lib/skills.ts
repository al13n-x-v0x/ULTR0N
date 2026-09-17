/**
 * Skills — self-describing actions the assistant can actually DO (Mark-LIV's
 * "self-describing skills" idea). Each skill declares name, description and a
 * run(). /urx skills lists what's live right now; autoBuff triggers them from
 * natural language; the system prompt tells the AI what it can honestly do.
 *
 * The headline skill: PUBLISH — search the web for hooks, write a viral
 * caption/title, then upload the video to YouTube for real via the bridge.
 */
import { bridgeHealth, bridgeOpenUrl, bridgeOpenApp, bridgeExec, bridgeYoutubeUpload, bridgeYoutubeJob, bridgeYoutubeAuth, hasBridgeToken, setBridgeToken, makeThumbnailDataUrl, type BridgeHealth } from './bridge'
import { askAi } from './ai'
import { useSettings } from '../store/settingsStore'
import { useUi } from '../store/uiStore'
import { addReminder, requestNotifyPermission } from './reminders'
import { useMemory } from '../store/memoryStore'

export interface SkillContext {
  arg: string
  log: (line: string) => void
}

export interface Skill {
  id: string
  name: string
  description: string
  /** When false the skill still lists, but says it needs setup. */
  available: (h?: BridgeHealth) => boolean
  requirement?: string
  run: (ctx: SkillContext, h?: BridgeHealth) => Promise<string>
}

/* ------------------------- viral copy generator ------------------------- */

const HOOK_PATTERNS = [
  'Stop scrolling — {topic} is not what you think.',
  'I tried {topic} for 30 days. Day 1 broke me.',
  'Nobody talks about this side of {topic}.',
  'The {topic} mistake 90% of people make (and the 10% who win)',
  'POV: you finally understand {topic}',
  'This {topic} trick feels illegal to know',
  'Watch this before you touch {topic} again',
  '3 seconds in and {topic} already hits different',
]

/** Build a viral hook + caption + thumbnail ideas through the active model. */
export async function generateViralCopy(topic: string, platform: 'youtube' | 'instagram' | 'tiktok'): Promise<{
  hook: string
  caption: string
  hashtags: string[]
  spokenCaption: string
  thumbIdeas: string[]
}> {
  const settings = useSettings.getState().settings
  const platformNote = platform === 'youtube'
    ? 'a punchy YouTube title (max 70 chars) plus a description'
    : platform === 'instagram'
      ? 'a punchy Instagram caption'
      : 'a punchy TikTok caption'
  try {
    const out = await askAi(
      settings,
      `You are a short-form viral editor. Write ${platformNote} for a video about: "${topic}".
Rules: strong hook in the first 5 words, curiosity gap, no clickbait lies, 1 emoji max.
Also give 8 relevant hashtags, a spoken narration of the caption (for subtitles, plain sentences), and 3 on-video thumbnail text ideas (max 4 words each).
Reply EXACTLY in this format:
HOOK: <the title/caption first line>
BODY: <description or caption body, 2-4 short lines>
TAGS: #tag1 #tag2 …
SPOKEN: <narration text for burned-in subtitles>
THUMBS: idea1 | idea2 | idea3`,
      'create',
    )
    const hook = out.match(/HOOK:\s*(.+)/i)?.[1]?.trim()
    const body = out.match(/BODY:\s*([\s\S]*?)(?:\nTAGS:|$)/i)?.[1]?.trim()
    const tags = [...out.matchAll(/#[\w-]+/g)].map((m) => m[0])
    const spoken = out.match(/SPOKEN:\s*([\s\S]*?)(?:\nTHUMBS:|$)/i)?.[1]?.trim()
    const thumbsLine = out.match(/THUMBS:\s*(.+)/i)?.[1]?.trim()
    const thumbIdeas = thumbsLine ? thumbsLine.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 3) : []
    if (hook) {
      return {
        hook,
        caption: body ?? hook,
        hashtags: tags,
        spokenCaption: spoken || body || hook,
        thumbIdeas: thumbIdeas.length ? thumbIdeas : fallbackThumbs(topic),
      }
    }
  } catch { /* fall through to patterns */ }
  // deterministic fallback — still decent without any model
  const pick = HOOK_PATTERNS[Math.floor(Math.random() * HOOK_PATTERNS.length)]
  const hook = pick.replace('{topic}', topic)
  const hashtags = ['#viral', '#fyp', `#${topic.toLowerCase().replace(/\s+/g, '')}`, '#creator', '#trending', '#shorts']
  const caption = `${hook}\n\nFull breakdown in the video — save this one.`
  return { hook, caption, hashtags, spokenCaption: caption, thumbIdeas: fallbackThumbs(topic) }
}

function fallbackThumbs(topic: string): string[] {
  const t = topic.length > 18 ? topic.slice(0, 18).trim() : topic
  return [t.toUpperCase(), 'DAY 1', 'WATCH THIS']
}

/* ------------------------- the registry ------------------------- */

export const SKILLS: Skill[] = [
  {
    id: 'web.open',
    name: 'Open any site',
    description: 'Opens a URL in your real browser — YouTube, Instagram, anything.',
    available: (h) => !!h?.ok,
    requirement: 'local bridge running',
    run: async ({ arg }) => {
      const url = /^https?:\/\//i.test(arg) ? arg : `https://${arg.replace(/\s+/g, '')}`
      return bridgeOpenUrl(url)
    },
  },
  {
    id: 'app.open',
    name: 'Launch an app',
    description: 'Launches a laptop app: notepad, calc, explorer, terminal…',
    available: (h) => !!h?.ok && !!h?.commandsEnabled,
    requirement: 'bridge + ULTRON_TOKEN',
    run: async ({ arg }) => bridgeOpenApp(arg),
  },
  {
    id: 'laptop.exec',
    name: 'Run a shell command',
    description: 'Executes a command on your laptop (dir listing, file moves…). You confirm first.',
    available: (h) => !!h?.ok && !!h?.commandsEnabled,
    requirement: 'bridge + ULTRON_TOKEN',
    run: async ({ arg }) => bridgeExec(arg),
  },
  {
    id: 'youtube.auth',
    name: 'Authorize YouTube',
    description: 'One-time Google OAuth so uploads can run. Opens an approval tab.',
    available: (h) => !!h?.ok && !!h?.youtubeConfigured,
    requirement: 'bridge with GOOGLE_CLIENT_ID/SECRET',
    run: async () => bridgeYoutubeAuth(),
  },
  {
    id: 'youtube.upload',
    name: 'Upload a video to YouTube',
    description: 'Viral title + description written by AI, then a real resumable upload of a local file.',
    available: (h) => !!h?.ok && !!h?.youtubeConfigured,
    requirement: 'bridge with GOOGLE_CLIENT_ID/SECRET',
    run: async ({ arg }) => {
      // arg: "<file path> | <topic>" (pipe separates; topic optional)
      const [filePath, ...topicRest] = arg.split('|').map((s) => s.trim())
      if (!filePath) throw new Error('Need a file path: /urx skill run youtube.upload C:\\videos\\clip.mp4 | my topic')
      const topic = topicRest.join(' | ') || filePath.split(/[\\/]/).pop()?.replace(/\.\w+$/, '') || 'my video'
      const copy = await generateViralCopy(topic, 'youtube')
      const desc = `${copy.caption}\n\n${copy.hashtags.join(' ')}`
      const jobId = await bridgeYoutubeUpload(filePath, {
        title: copy.hook.slice(0, 100),
        description: desc.slice(0, 4900),
        tags: copy.hashtags.map((t) => t.replace('#', '')),
        privacy: 'unlisted',
        mimeType: 'video/mp4',
        thumbnailDataUrl: await makeThumbnailDataUrl(copy.thumbIdeas[0] ?? topic),
      })
      // poll briefly for a fast finish, else report the job id
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const job = await bridgeYoutubeJob(jobId)
        if (job?.status === 'done') return `✅ Uploaded to YouTube (unlisted): https://youtu.be/${job.videoId}\nTitle used: "${copy.hook}"`
        if (job?.status === 'error') throw new Error(`Upload failed: ${job.error}`)
      }
      return `⏳ Upload running in the background (job ${jobId}). The bridge will finish the resumable upload — check the bridge console.`
    },
  },
  {
    id: 'viral.hook',
    name: 'Write a viral hook',
    description: 'AI-written hook, caption and hashtags for a topic — for YT / IG / TikTok.',
    available: () => true,
    run: async ({ arg, log }) => {
      const topic = arg || 'my day'
      log(`Writing a hook about "${topic}"…`)
      const copy = await generateViralCopy(topic, 'instagram')
      const preview = await makeThumbnailDataUrl(copy.thumbIdeas[0] ?? topic).catch(() => null)
      return `**Hook:** ${copy.hook}\n\n**Caption:**\n${copy.caption}\n\n**Tags:** ${copy.hashtags.join(' ')}\n\n**Thumbnail ideas:** ${copy.thumbIdeas.join(' · ')}${preview ? '\n\n*(a draft thumbnail PNG was rendered — check the bridge folder or the publish queue)*' : ''}`
    },
  },
  {
    id: 'system.remind',
    name: 'Set a reminder',
    description: 'Real scheduled reminder, fires in-app and as an OS notification.',
    available: () => true,
    run: async ({ arg }) => {
      const parsed = (await import('./reminders')).parseReminder(arg)
      if (!parsed) throw new Error('Could not parse a time — try "X in 20 minutes" or "at 18:45".')
      void requestNotifyPermission()
      addReminder(parsed.text, parsed.fireAt)
      return `⏰ Reminder set: "${parsed.text}" at ${new Date(parsed.fireAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    },
  },
  {
    id: 'memory.save',
    name: 'Remember a fact',
    description: 'Stores a long-term fact about you, recallable in every session.',
    available: () => true,
    run: async ({ arg }) => {
      if (!arg) throw new Error('Nothing to remember.')
      useMemory.getState().addMemory(arg, 'fact')
      return `Committed to memory: "${arg}"`
    },
  },
]

// keep the bridge token in sync with settings (settings is the source of truth)
useSettings.subscribe((s) => {
  setBridgeToken(s.settings.bridgeToken)
})

/* ------------------------- runner ------------------------- */

export interface SkillRunResult { ok: boolean; text: string; pendingConfirm?: { skill: string; arg: string } }

/** Commands that touch the real laptop require a confirmation chip first. */
const CONFIRM_SKILLS = new Set(['laptop.exec'])

export async function runSkill(id: string, arg: string): Promise<SkillRunResult> {
  const skill = SKILLS.find((s) => s.id === id)
  if (!skill) return { ok: false, text: `Unknown skill "${id}".` }
  if (CONFIRM_SKILLS.has(id) && !hasConfirmed(arg)) {
    return { ok: false, text: `⚠ This will run on your laptop:\n$ ${arg}\n\nRe-run with the confirm flag once you've read it.`, pendingConfirm: { skill: id, arg } }
  }
  const h = await bridgeHealth()
  if (!skill.available(h)) {
    return { ok: false, text: `**${skill.name}** needs: ${skill.requirement ?? 'setup'}.\n${h?.ok ? 'Bridge is running but not fully configured.' : 'Start the bridge: node bridge/ultron-bridge.mjs (see bridge/README.md).'}` }
  }
  try {
    const text = await skill.run({ arg, log: (l) => useUi.getState().pushToast({ title: skill.name, body: l, kind: 'info' }) }, h)
    return { ok: true, text }
  } catch (e) {
    return { ok: false, text: `✗ ${skill.name}: ${e instanceof Error ? e.message : String(e)}` }
  }
}

const confirmed = new Set<string>()
export function markConfirmed(arg: string): void { confirmed.add(arg) }
function hasConfirmed(arg: string): boolean { return confirmed.has(arg) }

/** List skills with live availability for /urx skills and the system prompt. */
export function skillsReport(h?: BridgeHealth): string {
  return SKILLS.map((s) => `• ${s.name} — ${s.description}${s.available(h) ? '' : ` (needs ${s.requirement})`}`).join('\n')
}

export async function currentBridgeHealth(): Promise<BridgeHealth> {
  return bridgeHealth()
}

export { setBridgeToken, hasBridgeToken, bridgeHealth }
