#!/usr/bin/env bash
#
# U.L.T.R.0.N. — one-line installer for Linux & macOS
#
#   curl -fsSL https://raw.githubusercontent.com/al13n-x-v0x/ULTR0N/main/install.sh | bash
#
# Installs the `ultr0n` CLI globally (bins: ultr0n, ultron, ultron-cli, ultra0n).
# Prefers the npm registry; falls back to installing from this GitHub repo.
# Zero trust needed: read it first — curl -fsSL <url> | less
#
set -euo pipefail

CY='\033[36m'; GRN='\033[32m'; YLW='\033[33m'; RED='\033[31m'; DIM='\033[2m'; B='\033[1m'; NC='\033[0m'
say()  { printf "%b\n" "$1"; }
die()  { printf "%b\n" "${RED}  ✗ $1${NC}" >&2; [ "${2:-}" ] && printf "%b\n" "${DIM}    $2${NC}" >&2; exit 1; }

PKG="ultr0n"
REPO="al13n-x-v0x/ULTR0N"
BRANCH="main"

say ""
say "${CY}   ⚡ U.L.T.R.0.N. installer${NC} ${DIM}(linux / macOS)${NC}"
say "${DIM}   by ${B}al13n-x-v0x${NC}${DIM} · https://github.com/${REPO}${NC}"
say ""

# ---------- 1. Node.js ----------
NODE_OK=0
if command -v node >/dev/null 2>&1; then
  MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "${MAJOR}" -ge 18 ] 2>/dev/null; then
    NODE_OK=1
    say "${GRN}  ✓ node $(node --version)${NC}"
  else
    say "${YLW}  ○ node $(node --version) is too old (need ≥18)${NC}"
  fi
else
  say "${YLW}  ○ node not found${NC}"
fi

if [ "${NODE_OK}" -eq 0 ]; then
  say "  ${DIM}▸ installing Node.js 22…${NC}"
  if command -v apt-get >/dev/null 2>&1; then
    (curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null 2>&1 \
      && sudo apt-get install -y nodejs >/dev/null 2>&1) \
      || die "could not install Node via apt" "install Node 18+ manually: https://nodejs.org"
  elif command -v dnf >/dev/null 2>&1; then
    (curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash - >/dev/null 2>&1 \
      && sudo dnf install -y nodejs >/dev/null 2>&1) \
      || die "could not install Node via dnf" "install Node 18+ manually: https://nodejs.org"
  elif command -v brew >/dev/null 2>&1; then
    brew install node >/dev/null 2>&1 || die "could not install Node via brew" "install Node 18+ manually: https://nodejs.org"
  else
    die "no supported package manager found (apt/dnf/brew)" "install Node 18+ from https://nodejs.org, then re-run"
  fi
  say "${GRN}  ✓ node $(node --version) installed${NC}"
fi

# ---------- 2. npm global prefix (sudo-less installs) ----------
if [ "$(id -u)" -eq 0 ]; then
  say "${DIM}  ▸ running as root — installing to the global prefix${NC}"
elif ! npm prefix -g >/dev/null 2>&1 || [ ! -w "$(npm prefix -g 2>/dev/null)" ]; then
  say "${YLW}  ○ npm global prefix not writable — switching to ~/.npm-global${NC}"
  mkdir -p "${HOME}/.npm-global"
  npm config set prefix "${HOME}/.npm-global"
  case ":${PATH}:" in
    *":${HOME}/.npm-global/bin:"*) ;;
    *) say "${DIM}    add this line to your ~/.bashrc or ~/.zshrc:${NC}"
       say "${DIM}      export PATH=\"\$HOME/.npm-global/bin:\$PATH\"${NC}" ;;
  esac
fi

# ---------- 3. install the CLI ----------
say "  ${DIM}▸ installing ${PKG}…${NC}"
NPM="npm"; command -v npm >/dev/null 2>&1 || NPM="$(dirname "$(command -v node)")/npm"

if "$NPM" install -g "${PKG}" >/dev/null 2>&1; then
  say "${GRN}  ✓ ${PKG} installed from npm${NC}"
else
  say "${YLW}  ○ npm registry miss — falling back to this GitHub repo${NC}"
  "$NPM" install -g "github:${REPO}#${BRANCH}" >/dev/null 2>&1 \
    || die "install failed (both npm and GitHub fallback)" "check your connection, then retry"
  say "${GRN}  ✓ ${PKG} installed from github:${REPO}${NC}"
fi

# ---------- 4. verify ----------
BIN=""
for c in ultr0n ultron ultra0n ultron-cli; do
  if command -v "$c" >/dev/null 2>&1; then BIN="$c"; break; fi
done
[ -n "${BIN}" ] || die "installed but binaries not found on PATH" "open a new shell and try: ultron version"

say ""
say "${GRN}  ⚡ $( "$BIN" version ) · ready${NC}"
say ""
say "  ${B}Next steps${NC}"
say "    ${CY}${BIN} start${NC}     bridge + web UI + browser, one shot"
say "    ${CY}${BIN} doctor${NC}    environment check + exact fixes"
say "    ${CY}${BIN} help${NC}      all commands"
say ""
say "${DIM}  aliases: ultr0n · ultron · ultra0n · ultron-cli${NC}"
say ""
