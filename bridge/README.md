# U.L.T.R.0.N. Bridge

The optional local companion that gives the web shell **real laptop control** —
open any site (YouTube, Instagram…), launch apps, run commands, and upload
videos to YouTube with AI-written viral titles.

> Zero dependencies · Node 18+ · by [al13n-x-v0x](https://github.com/al13n-x-v0x)

## Quick start

```bash
# 1. from the project root
node bridge/ultron-bridge.mjs

# 2. (recommended) with command execution enabled
ULTRON_TOKEN=change-me-to-a-long-secret node bridge/ultron-bridge.mjs

# 3. (for YouTube uploads) add your Google credentials
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com \
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx \
ULTRON_TOKEN=change-me-to-a-long-secret \
node bridge/ultron-bridge.mjs
```

The bridge listens on `http://localhost:8765`. The web app discovers it
automatically — paste the same secret into **Settings → Bridge & Avatar →
Bridge token**.

## What it enables

| Skill | Needs | What it does |
|---|---|---|
| Open any site | bridge | `open youtube` opens the real site in your real browser |
| Launch an app | bridge + token | `notepad`, `calc`, `explorer`, `terminal`… |
| Run a command | bridge + token | You confirm, then it runs on your laptop, output streams back |
| YouTube upload | bridge + Google keys | AI writes the viral title/description, file uploads via the resumable API |
| Viral hook | nothing | AI-generated hook + caption + hashtags (works with the on-device model) |
| Reminders · Memory | nothing | Already fully local — no bridge needed |

`/urx skills` in chat shows exactly which skills are live on your machine.

## YouTube setup (one time)

1. [Google Cloud Console](https://console.cloud.google.com) → new project
2. Enable **YouTube Data API v3**
3. OAuth consent screen → *External* → add yourself as a test user
4. Credentials → **OAuth client ID** → *Web application*
   - Authorized redirect URI: `http://localhost:8765/oauth2/callback`
5. Copy the client ID + secret into the env vars above
6. In chat: `/urx skill run youtube.auth` → approve in the opened tab
7. Upload: `/urx skill run youtube.upload C:\videos\clip.mp4 | my topic`

Uploads land as **unlisted** by default (change `privacy` in
`src/lib/skills.ts` when you're ready to go public).

## Security model

- The bridge binds to `127.0.0.1` only — nothing from the network can reach it
- Command execution requires `ULTRON_TOKEN`; without it `/exec` is hard-disabled
- The app sends the token from localStorage; it never leaves your machine
- Every action lands in the app's notification feed — full audit trail
- Instagram/TikTok auto-posting is **not** faked: they require per-platform
  partner API approval, and the app says so instead of pretending

## Why a bridge?

Browsers sandbox pages away from the OS — no tab can open apps or read files.
Mark-LIV ships a Python core for the same reason. This bridge is that core,
in one dependency-free file you can read in five minutes.
