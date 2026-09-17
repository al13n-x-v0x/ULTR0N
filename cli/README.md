# ultr0n — U.L.T.R.0.N. from your terminal

```bash
npm install -g ultr0n
ultron
```

One line, any OS:

```powershell
# Windows — cmd, PowerShell, or Win+R
powershell -ExecutionPolicy ByPass -c "irm https://raw.githubusercontent.com/al13n-x-v0x/ULTR0N/main/install.ps1 | iex"
```
```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/al13n-x-v0x/ULTR0N/main/install.sh | bash
```

Every name below is the **same binary** — pick your spelling:

```bash
npm install -g ultr0n     # canonical
npm install -g Ultr0n     # npm names are case-insensitive
# bins installed: ultr0n · ultron · ultron-cli · ultra0n
```

## The one-liner

```bash
ultron start
```

Starts the laptop-control bridge + serves the web UI + opens your browser. Ctrl+C stops everything cleanly.

## Commands

| Command | What it does |
|---|---|
| `ultron start` | bridge + web UI + browser, one shot |
| `ultron serve` | bridge only (laptop control for the web app) |
| `ultron ui` | web UI only |
| `ultron open youtube` | open youtube / instagram / any URL through the bridge |
| `ultron app notepad` | launch notepad, calc, explorer, terminal, paint |
| `ultron publish clip.mp4` | AI viral title → real YouTube upload (`--public`/`--private`, `--topic`) |
| `ultron ask "…"` | quick ask to your local Ollama model (`--model …`) |
| `ultron exec "cmd"` | shell command via the bridge (token-gated) |
| `ultron status` | bridge health at a glance |
| `ultron doctor` | full environment check + exact fix lines |
| `ultron models` | list installed Ollama models |
| `ultron auth` | YouTube OAuth consent flow |
| `ultron token <secret>` | save the bridge token (`~/.ultr0n/config.json`) |
| `ultron update` / `ultron uninstall` | self-manage |

## Configuration

`~/.ultr0n/config.json` (created by `ultron token`, `--port`):

```json
{ "token": "your-bridge-secret", "port": 8765, "model": "qwen2.5:0.5b" }
```

Environment overrides: `ULTRON_PORT`, `ULTRON_TOKEN`, `ULTRON_MODEL_BASE`.

Zero dependencies · Node 18+ · MIT · [al13n-x-v0x](https://github.com/al13n-x-v0x)
